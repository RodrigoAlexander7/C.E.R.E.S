"""Parcela, perfil progresivo, historial y runs inmutables (PostgreSQL real)."""

import pytest

from tests.conftest import MAJES_POLYGON, create_parcel, profile, register
from ceres.infrastructure.geometry import geodesic_area_ha

pytestmark = pytest.mark.db


def test_parcel_geodesic_area_pilot_and_recovery_after_reload(make_client):
    c = make_client()
    register(c)
    p = create_parcel(c)
    assert p["area_origin"] == "geodesica"
    assert 4.5 < p["area_ha"] < 5.2
    assert p["in_pilot_zone"] is True
    assert p["region_codes"]["district_code"] == "040520"
    cookies = dict(c.cookies)
    # «Recargar»: un cliente nuevo con la misma cookie recupera perfil e historial.
    c2 = make_client()
    for k, v in cookies.items():
        c2.cookies.set(k, v)
    me = c2.get("/api/v1/me").json()
    assert me["active_parcel_id"] == p["id"]
    detail = c2.get(f"/api/v1/parcels/{p['id']}").json()
    assert detail["profile"]["profile"]["current_crop_id"] == "maiz_grano"
    assert detail["crop_events"][0]["status"] == "en_campo"


def test_point_without_area_is_not_a_boundary(make_client):
    c = make_client()
    register(c)
    r = c.post("/api/v1/parcels", json={"point": {"lat": -16.35, "lon": -72.19}, "profile": profile()})
    assert r.status_code == 422 and "punto GPS" in r.json()["error"]["message"]


def test_invalid_geometry_and_values(make_client):
    c = make_client()
    register(c)
    bow = {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]}
    assert c.post("/api/v1/parcels", json={"geometry": bow, "profile": profile()}).json()["error"]["code"] == "geometria_invalida"
    bad = profile(water={"mode": "conozco", "allocation_m3": 1000, "efficiency": 85})
    r = c.post("/api/v1/parcels", json={"geometry": MAJES_POLYGON, "profile": bad})
    assert r.status_code == 422 and r.json()["error"]["code"] == "datos_invalidos"
    assert c.post("/api/v1/geometry/area", json={"geometry": MAJES_POLYGON}).json()["in_pilot_zone"] is True


def test_outside_pilot_explores_without_recommending(make_client):
    c = make_client()
    register(c)
    lima = {"type": "Polygon", "coordinates": [[[-77.05, -12.05], [-77.048, -12.05], [-77.048, -12.048], [-77.05, -12.048], [-77.05, -12.05]]]}
    p = c.post("/api/v1/parcels", json={"geometry": lima, "profile": profile()}).json()
    assert p["in_pilot_zone"] is False
    run = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={}).json()
    assert run["result"]["strategies"] == [] and run["result"]["blocking"]


def test_harvest_and_soil_keep_history(make_client):
    c = make_client()
    register(c)
    p = create_parcel(c)
    r = c.post(f"/api/v1/parcels/{p['id']}/crop-events", json={"crop_id": "maiz_grano", "status": "cosechado", "actual_harvest": "2027-02-10"})
    assert r.status_code == 201 and r.json()["new_revision"]["profile"]["current_status"] == "cosechado"
    r = c.post(f"/api/v1/parcels/{p['id']}/soil-observations", json={"sampled_on": "2027-01-20", "depth_cm": "0-30", "method": "extracto de saturación", "ece_ds_m": 2.1})
    assert r.status_code == 201
    soil = r.json()["new_revision"]["profile"]["soil"]
    assert soil["ece_ds_m"] == 2.1 and soil["ph"] is None  # desconocido sigue desconocido, no cero
    revs = c.get(f"/api/v1/parcels/{p['id']}/profile-revisions").json()["items"]
    assert [x["number"] for x in revs] == [3, 2, 1]
    assert revs[-1]["profile"]["current_status"] == "en_campo"  # el antecedente se conserva
    events = c.get(f"/api/v1/parcels/{p['id']}/crop-events").json()["items"]
    assert len(events) == 2


def test_scenario_creates_new_run_and_keeps_previous(make_client):
    c = make_client()
    register(c)
    p = create_parcel(c)
    first = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={}).json()
    assert first["result"]["climate_snapshot_id"].startswith("nasa-power-")
    assert first["dataset_sha256"]
    second = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={"scenario": {"allocation_m3": 6000}}).json()
    assert second["id"] != first["id"]
    # Las plantillas fijas no caben en 6 000 m³/mes; el plan del optimizador (D/E) solo propone lo que cabe.
    assert {v for k, v in second["statuses"].items() if k in "ABC"} == {"no_viable"}
    assert all(v != "no_viable" for k, v in second["statuses"].items() if k in ("D", "E"))
    assert second["scenario_label"].startswith("dotación 6,000")
    again = c.get(f"/api/v1/recommendations/{first['id']}").json()
    assert again["result"] == first["result"]  # el resultado anterior no se reescribe
    assert c.get(f"/api/v1/recommendations/{first['id']}/reproduce").json() == {"same_versions": True, "identical": True}
    third = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={"scenario": {"priority": "agua"}}).json()
    assert third["result"]["ordering"]["ranked"][0] == "A"
    assert len(c.get(f"/api/v1/parcels/{p['id']}/recommendations").json()["items"]) == 3


def test_profile_change_flags_old_runs(make_client):
    c = make_client()
    register(c)
    p = create_parcel(c)
    run = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={}).json()
    assert run["profile_changed"] is False
    changed = c.post(f"/api/v1/parcels/{p['id']}/profile-revisions", json={"profile": profile(priority="suelo"), "note": "cambio"})
    assert changed.status_code == 201, changed.text
    old = c.get(f"/api/v1/recommendations/{run['id']}").json()
    assert old["profile_changed"] is True
    assert old["inputs"] == run["inputs"] and old["result"] == run["result"]
    assert c.get(f"/api/v1/recommendations/{run['id']}/reproduce").json() == {"same_versions": True, "identical": True}


def test_unknown_water_uses_zone_assumption_never_dead_end(make_client):
    """R16: «no sé» → agua típica de Majes como supuesto; nada queda «No conviene» solo por un supuesto."""
    c = make_client()
    register(c)
    p = create_parcel(c, water={"mode": "no_se"})
    r = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={})
    assert r.status_code == 201
    run = r.json()
    assert set(run["inputs"]["assumed"]) == {"water.allocation", "water.efficiency"}
    assert run["inputs"]["profile"]["water"]["mode"] == "no_se"  # lo declarado se conserva tal cual
    levels = {s["strategy_id"]: s["simple"]["level"] for s in run["result"]["strategies"]}
    assert "buena" not in levels.values()  # un supuesto en restricción obligatoria nunca da «Buena opción»
    assert "no_conviene" not in levels.values()
    for s in run["result"]["strategies"]:
        assert any(d["id"] == "agua" for d in s["decisive"])
        dot = s["metrics"].get(f"{s['strategy_id']}.agua.dotacion_m3")
        assert dot and dot["kind"] == "supuesto_zona"


def test_zone_defaults_can_be_disabled(make_client):
    c = make_client()
    register(c)
    p = create_parcel(c, water={"mode": "no_se"}, use_zone_defaults=False)
    run = c.post(f"/api/v1/parcels/{p['id']}/recommendations", json={}).json()
    assert run["inputs"]["assumed"] == []
    assert set(run["statuses"].values()) == {"requiere_datos"}


def test_quick_compare_without_account_saves_nothing(make_client):
    from sqlalchemy import func, select

    from ceres.infrastructure.db import models as m

    c = make_client()
    body = {"geometry": MAJES_POLYGON, "profile": {"current_crop_id": "maiz_grano", "current_status": "cosechado", "current_crop_streak": 1, "priority": "dinero"}}
    r = c.post("/api/v1/public/quick-compare", json=body)
    assert r.status_code == 200
    data = r.json()
    ids = [s["strategy_id"] for s in data["result"]["strategies"]]
    assert ids[:3] == ["A", "B", "C"] and set(ids) <= {"A", "B", "C", "D", "E"} and data["result"]["simple_order"]
    assert data["result"]["optimizer"]["samples"] == 1000
    assert data["inputs"]["area_ha"] == pytest.approx(geodesic_area_ha(MAJES_POLYGON))
    assert data["inputs"]["area_ha"] != 5
    assert data["inputs"]["field_verified"] is True
    with c.container.sessions() as db:
        assert db.scalar(select(func.count()).select_from(m.RecommendationRun)) == 0
    # Responder una pregunta decisiva (parche) cambia el resultado de forma reproducible.
    body["profile"]["water"] = {"allocation_min_m3": 999999, "method": "goteo"}
    body["profile"]["soil"] = {"salinity_signs": "sin_signos"}
    levels = {s["strategy_id"]: s["simple"]["level"] for s in c.post("/api/v1/public/quick-compare", json=body).json()["result"]["strategies"]}
    assert levels["A"] == "buena" and levels["B"] == "buena" and levels["C"] == "explorar"


def test_public_demo_and_sources(make_client):
    from ceres.infrastructure.seed import run_seed

    c = make_client()
    run_seed(c.container.settings)
    demo = c.get("/api/v1/public/demo").json()
    assert demo["parcel"]["is_public_demo"] is True
    assert demo["run"]["result"]["strategies"]
    src = c.get("/api/v1/sources/NASA-POWER").json()
    assert src["kind"] == "observado" and src["fragments"]
    ctx = c.get("/api/v1/public/context").json()
    assert ctx["nasa"]["sha256"] and len(ctx["monthly_climatology"]) == 12
