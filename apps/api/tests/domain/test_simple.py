"""R15/R16: supuestos de zona, nivel sencillo y dato decisivo (con la serie NASA real)."""

import json
from dataclasses import replace
from datetime import date

import pytest

from ceres.application.recommendations import apply_zone_defaults, evaluate_frozen, frozen_inputs, set_path
from ceres.domain.engine import evaluate
from ceres.domain.model import ParcelInput, SoilInput, WaterInput

TODAY = date(2026, 11, 15)
BASE = {
    "current_crop_id": "maiz_grano",
    "current_status": "en_campo",
    "expected_harvest": "2027-02-15",
    "water": {"mode": "no_se"},
    "soil": {},
    "priority": "equilibrada",
    "residue_management": "no_se",
}


@pytest.fixture(scope="module")
def zone(base_settings):
    return json.loads((base_settings.data_dir / "catalog" / "zona_majes.json").read_text())


def run(profile, zone, catalog, climate, area=5):
    return evaluate_frozen(frozen_inputs(profile, area, True, TODAY, zone), catalog, climate)


def levels(r):
    return {s.strategy_id: s.simple["level"] for s in r.strategies}


def test_zone_defaults_only_fill_unknowns(zone):
    eff, assumed = apply_zone_defaults(BASE, 5, zone)
    assert set(assumed) == {"water.allocation", "water.efficiency"}
    assert eff["water"]["allocation_m3"] == round(22500 / 12 * 5)
    assert eff["water"]["efficiency"] == 0.75
    declared = set_path(set_path(BASE, "water.mode", "conozco"), "water.allocation_m3", 8000)
    declared = set_path(declared, "water.method", "goteo")
    eff2, assumed2 = apply_zone_defaults(declared, 5, zone)
    assert assumed2 == [] and eff2["water"]["allocation_m3"] == 8000 and eff2["water"]["efficiency"] == 0.9
    assert BASE["water"] == {"mode": "no_se"}  # el perfil declarado no se modifica


def test_all_unknown_gives_useful_options_not_dead_ends(zone, catalog, climate):
    r = run(BASE, zone, catalog, climate)
    lv = levels(r)
    assert "no_conviene" not in lv.values() and "buena" not in lv.values()
    assert lv["C"] == "explorar"  # una plantilla exploratoria nunca sube a «Posible» ni «Buena»
    for s in r.strategies:
        assert s.decisive, s.strategy_id
        assert s.simple["headline"] and s.simple["facts"]["first_sowing"]


def test_zone_assumption_never_gives_buena(zone, catalog, climate):
    # Con goteo y sin sal, el agua sigue siendo supuesto de zona → como máximo «Posible».
    p = set_path(set_path(BASE, "water.method", "goteo"), "soil.salinity_signs", "sin_signos")
    r = run(p, zone, catalog, climate, area=1)
    assert "buena" not in levels(r).values()


def test_answering_decisive_question_changes_level(zone, catalog, climate):
    p = set_path(set_path(BASE, "water.method", "goteo"), "soil.salinity_signs", "sin_signos")
    r = run(p, zone, catalog, climate)
    q = next(d for d in r.strategies[0].decisive if d["id"] == "agua")
    yes = q["answers"][0]["patch"]
    p_yes = set_path(p, *next(iter(yes.items())))
    assert levels(run(p_yes, zone, catalog, climate))["A"] == "buena"
    no = q["answers"][1]["patch"]
    p_no = set_path(p, *next(iter(no.items())))
    assert levels(run(p_no, zone, catalog, climate))["A"] == "no_conviene"  # declarado: ya no es supuesto


def test_salt_signs_block_sensitive_crops(zone, catalog, climate):
    p = set_path(set_path(BASE, "soil.salinity_signs", "con_signos"), "water.allocation_min_m3", 10**6)
    lv = levels(run(p, zone, catalog, climate))
    assert lv["B"] == "no_conviene" and lv["C"] == "no_conviene"
    assert lv["A"] == "posible"  # la eficiencia sigue siendo supuesto de zona
    lv2 = levels(run(set_path(p, "water.method", "goteo"), zone, catalog, climate))
    assert lv2["A"] == "buena" and lv2["B"] == "no_conviene"


def test_water_interval_logic(catalog, climate):
    def p(**w):
        return ParcelInput(
            area_ha=5, in_pilot_zone=True, current_crop_id="maiz_grano", current_status="en_campo",
            expected_harvest=date(2027, 2, 15), planned_next_crop_id=None,
            water=WaterInput(efficiency=0.9, **w), soil=SoilInput(ece_ds_m=0.5),
            priority="dinero", budget_soles=None, residue_management="no_se", reference_date=TODAY,
        )
    st = lambda r: {s.strategy_id: s for s in r.strategies}["A"]  # noqa: E731
    assert st(evaluate(p(allocation_min_m3=10**6), catalog, climate)).status == "viable_con_supuestos"
    assert st(evaluate(p(allocation_max_m3=10), catalog, climate)).status == "no_viable"
    between = st(evaluate(p(allocation_min_m3=10, allocation_max_m3=10**6), catalog, climate))
    assert between.status == "requiere_datos" and any(r.rule_id == "AGU-07" for r in between.reasons)


def test_simple_order_and_reproducibility(zone, catalog, climate):
    p = set_path(set_path(set_path(BASE, "water.method", "goteo"), "soil.salinity_signs", "sin_signos"), "water.allocation_min_m3", 10**6)
    p = set_path(p, "priority", "dinero")
    r = run(p, zone, catalog, climate)
    assert r.simple_order[:2] == ["B", "A"]  # buenas primero, por prioridad; exploratoria después
    assert r.simple_order[-1] == "C"
    assert run(p, zone, catalog, climate).to_dict() == r.to_dict()
