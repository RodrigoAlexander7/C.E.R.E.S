"""R21: optimizador del plan de siembra (programación dinámica + Monte Carlo) con NASA POWER real."""

import time
from dataclasses import replace
from datetime import date, timedelta

import pytest

from ceres.application.recommendations import apply_zone_defaults, parcel_input
from ceres.domain.engine import evaluate
from ceres.domain.model import SoilInput
from ceres.domain.optimizer import (
    Draws,
    _arcs,
    _validated_crops,
    best_paths,
    bisect_price,
    breakeven,
    cycle_profile,
    optimize,
    risk_stats,
    simulate,
)

START, END = date(2026, 11, 15), date(2028, 11, 14)


def make(zone, **over):
    prof = {"current_crop_id": "maiz_grano", "current_status": "cosechado", "water": {"mode": "no_se"}, "soil": {}, "priority": "dinero"}
    prof.update(over)
    eff, assumed = apply_zone_defaults(prof, 5, zone.data)
    return parcel_input(eff, 5, True, START, assumed, zone.context())


def brute_force(arcs, start, prep, first_family):
    best = 0.0

    def dfs(avail, fam, total):
        nonlocal best
        best = max(best, total)
        for a in arcs:
            if a.plant >= avail + timedelta(days=prep):
                own = a.value_repeat_ha if a.family == fam else a.value_ha
                dfs(a.harvest + timedelta(days=1), a.family, total + own)

    dfs(start, first_family, 0.0)
    return best


@pytest.mark.parametrize("water", [{"mode": "no_se"}, {"mode": "no_se", "allocation_min_m3": 10**6}])
def test_dynamic_programming_matches_brute_force(majes, water):
    p = make(majes, water=water)
    arcs = _arcs(p, majes.catalog, majes.climate, _validated_crops(majes.catalog), START, END, p.water.bounds()[1])
    paths = best_paths(arcs, START, majes.catalog.prep_days, "Poaceae", False)
    assert paths
    assert abs(paths[0][0] - brute_force(arcs, START, majes.catalog.prep_days, "Poaceae")) < 1e-6
    assert [v for v, _ in paths] == sorted((v for v, _ in paths), reverse=True)


def test_plan_respects_water_rotation_window_and_horizon(majes):
    p = make(majes)  # agua típica de la zona: 9 375 m³/mes para 5 ha
    r = optimize(p, majes.catalog, majes.climate, START, END)
    hi = p.water.bounds()[1]
    # Con el agua típica ya no deja la chacra casi vacía: repetir familia se permite (rinde 10 % menos).
    assert r.best and len(r.best.cycles) >= 2
    for plan in [x for x in (r.best, r.explore) if x] + r.candidates:
        for cid, d in plan.cycles:
            crop = majes.catalog.crop(cid)
            assert any(w.contains(d) for w in crop.windows)
            assert d + timedelta(days=crop.cycle_days - 1) <= END
            prof = cycle_profile(majes.climate, crop, d)
            assert prof.peak_net_mm * prof.ratio_ok / p.water.efficiency * 10 * 5 <= hi + 1e-6


def test_repeating_family_costs_yield(majes):
    p = make(majes, water={"mode": "no_se", "allocation_min_m3": 10**6})
    d = Draws.make(n=200)
    once = simulate([("frejol_grano", date(2027, 3, 1))], p, majes.catalog, majes.climate, d, None)
    twice = simulate([("frejol_grano", date(2027, 3, 1)), ("frejol_grano", date(2028, 3, 1))], p, majes.catalog, majes.climate, d, None)
    second = [b - a for a, b in zip(once, twice)]
    # el segundo frejol seguido rinde menos que el primero (antecedente maíz: otra familia)
    assert sum(second) / len(second) < sum(once) / len(once)


def test_validated_plan_never_uses_exploratory_crops(majes):
    r = optimize(make(majes, water={"mode": "no_se", "allocation_min_m3": 10**6}), majes.catalog, majes.climate, START, END)
    assert r.best and not any(majes.catalog.crop(c).exploratory for c in r.best.sequence)
    assert "cebolla_roja" not in r.best.sequence  # solo aparece en una plantilla exploratoria
    if r.explore:
        assert r.explore.score > r.best.score


def test_salt_excludes_sensitive_crops(majes):
    p = replace(make(majes, water={"mode": "no_se", "allocation_min_m3": 10**6}), soil=SoilInput(ece_ds_m=4.0))
    r = optimize(p, majes.catalog, majes.climate, START, END)
    used = {c for plan in r.candidates for c in plan.sequence}
    assert "frejol_grano" not in used  # FAO-29: frejol pierde el 50 % a 3,6 dS/m


def test_reproducible_and_beta_zero_is_the_mean(majes):
    p = make(majes, water={"mode": "no_se", "allocation_min_m3": 10**6})
    a = optimize(p, majes.catalog, majes.climate, START, END)
    b = optimize(p, majes.catalog, majes.climate, START, END)
    assert a.best.cycles == b.best.cycles and a.best.stats == b.best.stats
    xs = simulate(list(a.best.cycles), p, majes.catalog, majes.climate, Draws.make(), None)
    st = risk_stats(xs, beta=0.0)
    assert st["score_soles"] == st["mean_soles"] and st["cvar20_soles"] <= st["mean_soles"]


def test_breakeven_price_zeroes_expected_margin(majes):
    p = make(majes, water={"mode": "no_se", "allocation_min_m3": 10**6})
    r = optimize(p, majes.catalog, majes.climate, START, END)
    draws = Draws.make()
    cyc = list(r.best.cycles)
    be = breakeven(cyc, p, majes.catalog, majes.climate, draws, None)
    assert be and 0 < be["price_soles_kg"] < be["current_soles_kg"]
    mult = be["price_soles_kg"] / be["current_soles_kg"]
    xs = simulate(cyc, p, majes.catalog, majes.climate, draws, None, {be["crop_id"]: mult})
    assert abs(sum(xs) / len(xs)) < 0.01 * abs(r.best.stats["mean_soles"]) + 200  # redondeo del precio a céntimos
    assert abs(bisect_price(lambda x: x * x - 2, 0, 2) - 2**0.5) < 1e-9
    assert bisect_price(lambda x: x + 1, 0, 1) is None  # sin cambio de signo no inventa una raíz


def test_engine_adds_suggested_plan_with_risk_and_it_is_fast(majes, catalog, climate):
    p = make(majes)
    evaluate(p, catalog, climate)  # calienta el caché de perfiles NASA
    t = time.perf_counter()
    r = evaluate(p, catalog, climate)
    assert time.perf_counter() - t < 0.6  # objetivo < 300 ms en la VM; margen para CI
    ids = [s.strategy_id for s in r.strategies]
    assert ids[:3] == ["A", "B", "C"]
    assert r.optimizer and r.optimizer["samples"] == 1000
    for s in r.strategies:
        if s.simple["facts"]["margin_soles"] is not None:
            risk = s.simple["facts"]["risk"]
            assert risk and risk["p10_soles"] <= risk["mean_soles"] <= risk["p90_soles"] and 0 <= risk["p_loss"] <= 1
    roles = r.optimizer["roles"]
    if "D" in roles and roles["D"] == "sugerido":
        d = next(s for s in r.strategies if s.strategy_id == "D")
        assert "Plan sugerido por CERES" in d.simple["tags"]
        assert not any(rr.rule_id == "AGU-04" for rr in d.reasons)  # cabe en el agua típica
