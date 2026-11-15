"""Motor: calendarios, restricciones, unidades, margen y estados con la serie NASA real guardada."""

from dataclasses import replace
from datetime import date, timedelta

import pytest

from ceres.domain.engine import ClimateInput, add_months, evaluate
from ceres.domain.model import EconomicOverride, InvalidInput, ParcelInput, SoilInput, WaterInput

TODAY = date(2026, 11, 14)


def base(**kw) -> ParcelInput:
    p = ParcelInput(
        area_ha=5,
        in_pilot_zone=True,
        current_crop_id="maiz_grano",
        current_status="en_campo",
        expected_harvest=date(2027, 2, 15),
        planned_next_crop_id=None,
        water=WaterInput("conozco", 12000, "mensual", 0.85, "toma"),
        soil=SoilInput(ece_ds_m=0.9, analysis_date=date(2026, 6, 1), method="extracto", depth_cm="0-30", kind="observado"),
        priority="dinero",
        budget_soles=None,
        residue_management="incorporar",
        reference_date=TODAY,
    )
    return replace(p, **kw)


def by_id(result):
    return {s.strategy_id: s for s in result.strategies}


def test_calendar_full_cycles_no_overlap_within_common_horizon(catalog, climate):
    r = evaluate(base(), catalog, climate)
    assert r.horizon_start == date(2027, 2, 16)  # día siguiente a la cosecha prevista
    assert r.horizon_end == date(2029, 2, 15)
    for s in r.strategies:
        crops = [b for b in s.timeline if b.kind == "cultivo"]
        assert crops, s.strategy_id
        for a, b in zip(crops, crops[1:]):
            assert b.start > a.end  # sin solape de monocultivos sobre la misma área
            assert (b.start - a.end).days > catalog.prep_days  # preparación entre campañas
        for c in crops:
            assert r.horizon_start <= c.start and c.end <= r.horizon_end  # ciclos completos, sin truncar
            prof = catalog.crops[c.crop_id]
            assert (c.end - c.start).days + 1 == prof.cycle_days
            assert any(w.contains(c.start) for w in prof.windows)
        blocks = sorted(s.timeline, key=lambda b: b.start)
        for a, b in zip(blocks, blocks[1:]):
            assert b.start == a.end + timedelta(days=1)  # línea de tiempo continua


def test_leap_year_and_month_end_horizon():
    assert add_months(date(2027, 2, 28), 24) == date(2029, 2, 28)
    assert add_months(date(2028, 2, 29), 12) == date(2029, 2, 28)
    assert add_months(date(2026, 8, 31), 6) == date(2027, 2, 28)


def test_water_units_mm_to_m3(catalog, climate):
    s = by_id(evaluate(base(), catalog, climate))["B"]
    net_mm = s.metrics["B.agua.neto_mm"].value
    assert s.metrics["B.agua.neto_m3"].value == pytest.approx(net_mm * 10 * 5)  # 1 mm·ha = 10 m³
    assert s.metrics["B.agua.bruto_m3"].value == pytest.approx(net_mm * 10 * 5 / 0.85)
    assert sum(m["net_mm"] for m in s.monthly_water) == pytest.approx(net_mm, abs=0.5 * len(s.monthly_water))
    assert all(m["etc_mm"] >= m["net_mm"] >= 0 for m in s.monthly_water)


def test_nasa_dates_change_water_demand(catalog, climate):
    """Cambiar el calendario recalcula la demanda con la evidencia NASA."""
    early = by_id(evaluate(base(expected_harvest=date(2027, 2, 15)), catalog, climate))["B"]
    late = by_id(evaluate(base(expected_harvest=date(2027, 5, 20)), catalog, climate))["B"]
    first_early = next(b for b in early.timeline if b.kind == "cultivo")
    first_late = next(b for b in late.timeline if b.kind == "cultivo")
    assert first_early.start != first_late.start  # el frejol se siembra en otra fecha
    assert early.metrics["B.agua.etc_mm"].value != pytest.approx(late.metrics["B.agua.etc_mm"].value, rel=1e-3)
    assert "NASA-POWER" in early.metrics["B.agua.etc_mm"].source_ids


def test_gross_margin_sums_all_cycles(catalog, climate):
    s = by_id(evaluate(base(), catalog, climate))["A"]
    cycles = [b for b in s.timeline if b.kind == "cultivo"]
    e = catalog.crops["maiz_grano"].economics
    per_ha = e.yield_t_ha * 1000 * e.price_soles_kg - e.variable_cost_soles_ha - catalog.transition_cost_soles_ha
    assert s.metrics["A.eco.margen"].value == pytest.approx(per_ha * 5 * len(cycles))
    assert s.metrics["A.eco.margen_bajo"].value < s.metrics["A.eco.margen"].value < s.metrics["A.eco.margen_alto"].value
    assert "No es ganancia neta" in s.metrics["A.eco.margen"].detail


def test_water_deficit_not_compensated_by_margin(catalog, climate):
    r = evaluate(base(water=WaterInput("conozco", 5000, "mensual", 0.85)), catalog, climate)
    s = by_id(r)
    assert all(x.status == "no_viable" for x in r.strategies)
    assert any(rr.rule_id == "AGU-04" for rr in s["C"].reasons)  # C tiene el mayor margen y aun así no es viable
    assert r.ordering["ranked"] == []  # nada se ordena por dinero si no es viable


def test_unknown_water_requires_data_not_zero(catalog, climate):
    r = evaluate(base(water=WaterInput("no_se")), catalog, climate)
    for s in r.strategies:
        assert s.status == "requiere_datos"
        assert any(rr.rule_id == "AGU-01" for rr in s.reasons)
        assert f"{s.strategy_id}.agua.etc_mm" in s.metrics  # la demanda NASA sí se calcula


def test_annual_allocation_is_not_monthly_evidence(catalog, climate):
    r = evaluate(base(water=WaterInput("conozco", 150000, "anual", 0.85)), catalog, climate)
    assert all(s.status == "requiere_datos" for s in r.strategies)


def test_unknown_salinity_blocks_sensitive_crops_only(catalog, climate):
    s = by_id(evaluate(base(soil=SoilInput()), catalog, climate))
    assert s["A"].status == "viable_con_supuestos"  # maíz no es sensible: supuesto visible
    assert any("Salinidad no medida" in a for a in s["A"].assumptions)
    assert s["B"].status == "requiere_datos"  # frejol sensible a sales
    assert s["C"].status == "requiere_datos"


def test_high_salinity_makes_bean_not_viable(catalog, climate):
    s = by_id(evaluate(base(soil=SoilInput(ece_ds_m=4.0, kind="declarado")), catalog, climate))
    assert s["B"].status == "no_viable"
    assert s["A"].status == "viable_con_supuestos"
    assert any(r.rule_id == "SUE-03" for r in s["A"].reasons)  # maíz: pierde rendimiento, se refleja en margen


def test_insufficient_budget(catalog, climate):
    s = by_id(evaluate(base(budget_soles=10000), catalog, climate))
    assert s["A"].status == "no_viable"
    assert any(r.rule_id == "ECO-03" for r in s["A"].reasons)


def test_missing_costs_no_precise_money_ranking(catalog, climate, monkeypatch):
    from dataclasses import replace as rp

    crops = dict(catalog.crops)
    crops["frejol_grano"] = rp(crops["frejol_grano"], economics=rp(crops["frejol_grano"].economics, price_soles_kg=None))
    cat = rp(catalog, crops=crops)
    r = evaluate(base(), cat, climate)
    s = by_id(r)
    assert "B.eco.margen" not in s["B"].metrics
    assert s["B"].status == "viable_con_supuestos"
    assert "B" not in r.ordering["ranked"]


def test_declared_prices_override_demo_values(catalog, climate):
    # Solo el precio es propio: el margen sigue dependiendo de valores de ejemplo y se etiqueta así.
    partial = by_id(evaluate(base(economic_overrides=(EconomicOverride("maiz_grano", price_soles_kg=1.0),)), catalog, climate))
    m = partial["A"].metrics["A.eco.margen"]
    assert m.kind == "supuesto_demo" and "PARCELA" in m.source_ids
    full = EconomicOverride("maiz_grano", yield_t_ha=8.0, price_soles_kg=1.0, variable_cost_soles_ha=7000)
    s = by_id(evaluate(base(economic_overrides=(full,)), catalog, climate))
    assert s["A"].metrics["A.eco.margen"].kind == "declarado"
    assert s["A"].metrics["A.eco.margen"].value != partial["A"].metrics["A.eco.margen"].value


def test_exploratory_strategy_never_ranked(catalog, climate):
    r = evaluate(base(), catalog, climate)
    assert by_id(r)["C"].status == "exploratoria"
    assert "C" not in r.ordering["ranked"]
    assert r.associations[0]["status"] == "exploratoria"


def test_priority_reorders_only_comparable(catalog, climate):
    money = evaluate(base(priority="dinero"), catalog, climate).ordering["ranked"]
    water = evaluate(base(priority="agua"), catalog, climate).ordering["ranked"]
    assert set(money) == set(water) == {"A", "B"}
    assert money[0] == "B" and water[0] == "A"
    bal = evaluate(base(priority="equilibrada"), catalog, climate).ordering
    assert bal["ranked"] == [] and bal["tradeoffs"]


def test_alfalfa_is_accepted_as_previous_crop_and_outside_pilot_blocks(catalog, climate):
    r = evaluate(base(current_crop_id="alfalfa"), catalog, climate)
    assert r.blocking == [] and r.strategies
    s = by_id(r)
    assert s["A"].status == "requiere_datos"  # mantener la alfalfa no se compara (perenne)
    assert s["B"].timeline and s["C"].timeline  # las alternativas sí se calculan
    assert any("levantas la alfalfa" in n for n in r.notes)
    r = evaluate(base(in_pilot_zone=False), catalog, climate)
    assert r.strategies == [] and "fuera de las zonas piloto" in r.blocking[0]


def test_non_catalog_plan_requires_data(catalog, climate):
    s = by_id(evaluate(base(planned_next_crop_id="maiz_chala"), catalog, climate))
    assert s["A"].status == "requiere_datos"


def test_missing_harvest_date_blocks(catalog, climate):
    r = evaluate(base(expected_harvest=None), catalog, climate)
    assert r.strategies == [] and "fecha prevista de cosecha" in r.blocking[0]


def test_no_nasa_means_water_pending(catalog):
    r = evaluate(base(), catalog, ClimateInput(None, None))
    assert r.climate_snapshot_id is None
    assert all(s.status == "requiere_datos" for s in r.strategies)
    assert all(f"{s.strategy_id}.agua.etc_mm" not in s.metrics for s in r.strategies)


def test_invalid_inputs_rejected(catalog, climate):
    with pytest.raises(InvalidInput):
        evaluate(base(area_ha=0), catalog, climate)
    with pytest.raises(InvalidInput):
        evaluate(base(water=WaterInput("conozco", 1000, "mensual", 85)), catalog, climate)  # 85 % sin convertir


def test_reproducible(catalog, climate):
    assert evaluate(base(), catalog, climate).to_dict() == evaluate(base(), catalog, climate).to_dict()


def test_legume_gets_no_nitrogen_credit(catalog, climate):
    s = by_id(evaluate(base(), catalog, climate))["B"]
    assert not any("kg N" in m.unit for m in s.metrics.values())
    assert "Sin crédito fijo" in s.soil["contributions"]["legume_note"]
    assert not any(c.is_legume for c in catalog.crops.values() if c.family == "Poaceae")
