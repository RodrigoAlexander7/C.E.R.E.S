"""R19: «¿Cuándo me conviene sembrar?» con NASA POWER real y fases ENSO del ONI real de NOAA."""

from datetime import date, timedelta

import pytest

from ceres.domain.engine import enso_summary, sowing_window
from ceres.domain.enso import campaign_phase, monthly_phases
from ceres.infrastructure.noaa_oni import load_oni, parse_oni


@pytest.fixture(scope="module")
def phases(base_settings):
    return monthly_phases(load_oni(base_settings.data_dir / "noaa" / "oni.ascii.txt").anomalies)


def test_oni_phases_follow_noaa_rule(phases):
    # Episodios documentados por NOAA: El Niño fuerte 2015–16 y La Niña 2020–21.
    assert phases[(2015, 10)] == "el_nino" and phases[(2016, 1)] == "el_nino"
    assert phases[(2020, 12)] == "la_nina" and phases[(2021, 1)] == "la_nina"
    # Cuatro trimestres sobre +0,5 no bastan: hacen falta cinco seguidos.
    four = {(2000, m): (0.6 if 3 <= m <= 6 else 0.0) for m in range(1, 13)}
    assert set(monthly_phases(four).values()) == {"neutro"}
    five = {(2000, m): (0.6 if 3 <= m <= 7 else 0.0) for m in range(1, 13)}
    assert [m for (_, m), ph in sorted(monthly_phases(five).items()) if ph == "el_nino"] == [3, 4, 5, 6, 7]


def test_parse_oni_rejects_garbage():
    with pytest.raises(Exception):
        parse_oni("<html>no es el archivo</html>")


def test_campaign_phase_majority_and_missing(phases):
    assert campaign_phase(date(2015, 9, 1), date(2015, 12, 31), phases) == "el_nino"
    assert campaign_phase(date(2030, 1, 1), date(2030, 3, 1), phases) is None  # sin ONI: no se inventa


def test_sowing_month_changes_water_and_matches_manual_etc(catalog, climate):
    crop = catalog.crop("frejol_grano")
    months = sowing_window(crop, climate, 0.75)
    assert len(months) == 12 and all(m["available"] for m in months)
    etc = [m["etc_mm"] for m in months]
    assert len(set(etc)) > 6  # cambiar el mes cambia la cifra
    # Mismo cálculo que el motor: Σ Kc(día) × ET0 climatológica del día.
    plant = date(2027, 3, 15)
    manual = sum(crop.kc_on_day(k) * climate.et0(plant + timedelta(days=k)) for k in range(crop.cycle_days))
    assert months[2]["etc_mm"] == pytest.approx(manual, abs=0.1)
    m = months[2]
    assert m["net_mm"] <= m["etc_mm"]
    assert m["gross_m3_ha"] == round(m["net_mm"] / 0.75 * 10)
    assert m["etc_mm_range"][0] <= m["etc_mm"] <= m["etc_mm_range"][1]
    assert {t["rule_id"] for t in m["thermal"]} == {r.id for r in crop.thermal_rules}
    # Eficiencia mayor → menos agua bruta, misma demanda del cultivo.
    drip = sowing_window(crop, climate, 0.9)[2]
    assert drip["etc_mm"] == m["etc_mm"] and drip["gross_m3_ha"] < m["gross_m3_ha"]


def test_enso_groups_only_real_campaigns(catalog, climate, phases):
    months = sowing_window(catalog.crop("maiz_grano"), climate, 0.75, phases)
    summary = enso_summary(months)
    for row in summary:
        total = sum(g["n"] for g in row["groups"])
        month = next(m for m in months if m["month"] == row["month"])
        assert total == len([c for c in month["campaigns"] if c["phase"]])
        for g in row["groups"]:
            if g["n"] == 0:
                assert "etc_mm" not in g  # sin campañas no hay promedio (un ausente no es cero)
    # El Niño 2015–16 aparece en alguna campaña sembrada a fines de 2015.
    assert any(c["year"] == 2015 and c["phase"] == "el_nino" for c in months[9]["campaigns"])


def test_sowing_window_endpoint(make_client):
    c = make_client()
    r = c.get("/api/v1/public/sowing-window", params={"crop": "frejol_grano"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["zone_id"] == "majes" and len(d["months"]) == 12
    assert d["efficiency"]["kind"] == "supuesto_zona"
    assert d["enso"]["available"] and d["enso"]["oni"]["sha256"]
    goteo = c.get("/api/v1/public/sowing-window", params={"crop": "frejol_grano", "method": "goteo"}).json()
    assert goteo["efficiency"]["kind"] == "declarado"
    assert goteo["months"][3]["gross_m3_ha"] < d["months"][3]["gross_m3_ha"]
    assert c.get("/api/v1/public/sowing-window", params={"crop": "maiz_chala"}).status_code == 404  # sin ficha
    assert c.get("/api/v1/public/sowing-window", params={"crop": "frejol_grano", "zone": "otra"}).status_code == 404
