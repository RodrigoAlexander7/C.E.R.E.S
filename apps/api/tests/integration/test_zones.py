"""Incremento 15: zonas piloto configurables (Majes I y Valle de Chilina) sin mezclar clima, supuestos ni catálogo."""

from datetime import date

import pytest

from ceres.application.recommendations import evaluate_frozen, frozen_inputs
from ceres.infrastructure.geometry import geodesic_area_ha

from ..conftest import MAJES_POLYGON, create_parcel, register

CHILINA_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[-71.5300, -16.3655], [-71.5291, -16.3655], [-71.5291, -16.3646], [-71.5300, -16.3646], [-71.5300, -16.3655]]],
}
UNKNOWN = {"current_crop_id": "papa", "current_status": "cosechado", "current_crop_streak": 1, "water": {"mode": "no_se"}, "soil": {}, "priority": "equilibrada"}
TODAY = date(2026, 11, 15)


def test_registry_keeps_zones_apart(zones):
    majes, chilina = zones.get("majes"), zones.get("chilina")
    assert majes.snapshot.sha256 != chilina.snapshot.sha256
    assert majes.climate.source_id == "NASA-POWER" and chilina.climate.source_id == "NASA-POWER-CHILINA"
    assert len(chilina.snapshot.days) == 4018 and not any(chilina.snapshot.missing_by_parameter.values())
    assert chilina.snapshot.cell_elevation_m > 3000  # limitación documentada: celda más alta que el valle
    assert not set(majes.districts) & set(chilina.districts)
    assert zones.zone_of_district("040103").id == "chilina" and zones.zone_of_district("040520").id == "majes"
    assert zones.zone_of_district("040101") is None  # Arequipa cercado no es zona piloto
    # Nada copiado de Majes: sin economía de ejemplo, otras duraciones y su propio supuesto de agua.
    assert all(c.economics.yield_t_ha is None and c.economics.price_soles_kg is None for c in chilina.catalog.crops.values())
    assert chilina.catalog.crop("maiz_grano").stage_days != majes.catalog.crop("maiz_grano").stage_days
    assert chilina.data["water_m3_ha_year"]["value"] == round(1.7268e6 / 75.08, -3)
    assert chilina.data["water_m3_ha_year"]["value"] != majes.data["water_m3_ha_year"]["value"]
    assert chilina.data["default_method"]["value"] == "gravedad"


def test_chilina_all_unknown_uses_its_own_evidence(zones):
    chilina = zones.get("chilina")
    inputs = frozen_inputs(UNKNOWN, 1, True, TODAY, chilina)
    assert inputs["zone_id"] == "chilina" and inputs["zone_version"] == chilina.version
    assert inputs["effective_profile"]["water"]["allocation_m3"] == round(23000 / 12)
    assert inputs["effective_profile"]["water"]["efficiency"] == 0.6
    r = evaluate_frozen(inputs, chilina)
    assert r.climate_snapshot_id == chilina.snapshot.snapshot_id and r.catalog_version == chilina.catalog.version
    sources = {sid for s in r.strategies for x in s.reasons for sid in x.source_ids}
    assert "NASA-POWER-CHILINA" in sources and "ANA-CHILI-REGULADO-2022" in sources
    assert not {"NASA-POWER", "AUTODEMA-INDICADORES-2023", "ZONA-MAJES", "DEMO-ECONOMIA"} & sources
    for s in r.strategies:
        assert s.simple["level"] != "buena" and s.decisive, s.strategy_id  # nunca callejón sin salida
        assert s.simple["facts"]["margin_soles"] is None  # sin precios locales: margen pendiente, no inventado
    # Misma entrada en Majes → otra evidencia.
    majes = zones.get("majes")
    r2 = evaluate_frozen(frozen_inputs({**UNKNOWN, "current_crop_id": "maiz_grano"}, 1, True, TODAY, majes), majes)
    assert r2.climate_snapshot_id == majes.snapshot.snapshot_id != r.climate_snapshot_id


def test_quick_compare_per_zone_and_crop_validation(make_client):
    c = make_client()
    body = {"profile": UNKNOWN, "geometry": CHILINA_POLYGON, "zone_id": "chilina"}
    r = c.post("/api/v1/public/quick-compare", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["inputs"]["zone_id"] == "chilina"
    assert r.json()["inputs"]["area_ha"] == pytest.approx(geodesic_area_ha(CHILINA_POLYGON))
    bad = c.post("/api/v1/public/quick-compare", json={**body, "profile": {**UNKNOWN, "current_crop_id": "frejol_grano"}})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "cultivo_de_otra_zona"
    # Con contorno, una zona declarada distinta de la ubicación es una incoherencia.
    assert c.post("/api/v1/public/quick-compare", json={**body, "zone_id": "lima"}).status_code == 422
    assert c.get("/api/v1/public/context", params={"zone": "lima"}).status_code == 404
    zs = c.get("/api/v1/public/zones").json()
    assert [z["id"] for z in zs["items"]] == ["majes", "chilina"]
    ctx = c.get("/api/v1/public/context", params={"zone": "chilina"}).json()
    assert ctx["nasa"]["source_id"] == "NASA-POWER-CHILINA" and len(ctx["monthly_climatology"]) == 12
    assert c.get("/api/v1/catalog", params={"zone": "chilina"}).json()["version"].startswith("catalogo-chilina")


def test_parcel_and_run_freeze_their_zone(make_client):
    c = make_client()
    register(c)
    pm = create_parcel(c)
    assert pm["zone_id"] == "majes"
    r = c.post("/api/v1/parcels", json={"name": "Chacra Chilina", "geometry": CHILINA_POLYGON, "profile": UNKNOWN})
    assert r.status_code == 201, r.text
    pc = r.json()
    assert pc["zone_id"] == "chilina" and pc["in_pilot_zone"] is True
    run = c.post(f"/api/v1/parcels/{pc['id']}/recommendations", json={}).json()
    chilina = c.container.zone("chilina")
    assert run["inputs"]["zone_id"] == "chilina"
    assert run["dataset_snapshot_id"] == chilina.snapshot.snapshot_id and run["dataset_sha256"] == chilina.snapshot.sha256
    assert run["catalog_version"] == chilina.catalog.version
    rep = c.get(f"/api/v1/recommendations/{run['id']}/reproduce").json()
    assert rep == {"same_versions": True, "identical": True}
    runm = c.post(f"/api/v1/parcels/{pm['id']}/recommendations", json={}).json()
    assert runm["inputs"]["zone_id"] == "majes" and runm["dataset_snapshot_id"] != run["dataset_snapshot_id"]
    # Un cultivo de Majes no se puede declarar en una parcela de Chilina.
    bad = c.post(f"/api/v1/parcels/{pc['id']}/crop-events", json={"crop_id": "frejol_grano", "status": "en_campo"})
    assert bad.status_code == 422


def test_draw_outline_keeps_zone_and_old_runs(make_client):
    c = make_client()
    register(c)
    r = c.post("/api/v1/parcels", json={"name": "Por punto", "point": {"lat": -16.362, "lon": -71.535}, "area_ha": 1, "profile": UNKNOWN})
    assert r.status_code == 201 and r.json()["zone_id"] == "chilina"
    pid = r.json()["id"]
    run1 = c.post(f"/api/v1/parcels/{pid}/recommendations", json={}).json()
    assert run1["inputs"]["field_verified"] is False
    assert run1["result"]["blocking"] and run1["result"]["strategies"] == []
    assert run1["dataset_snapshot_id"] is None and run1["dataset_sha256"] is None
    p = c.patch(f"/api/v1/parcels/{pid}", json={"geometry": CHILINA_POLYGON})
    assert p.status_code == 200, p.text
    assert p.json()["area_origin"] == "geodesica" and p.json()["area_ha"] != 1 and p.json()["name"] == "Por punto"
    old = c.get(f"/api/v1/recommendations/{run1['id']}").json()
    assert old["inputs"] == run1["inputs"] and old["result"] == run1["result"]
    run2 = c.post(f"/api/v1/parcels/{pid}/recommendations", json={})
    assert run2.status_code == 201, run2.text
    assert run2.json()["inputs"]["field_verified"] is True
    assert run2.json()["result"]["blocking"] == [] and run2.json()["result"]["strategies"]
    assert run2.json()["inputs"]["area_ha"] == pytest.approx(p.json()["area_ha"])
    bad = c.patch(f"/api/v1/parcels/{pid}", json={"geometry": MAJES_POLYGON})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "otra_zona"


def test_district_lookup_reports_zone(make_client):
    c = make_client()
    d = c.get("/api/v1/regions/locate", params={"lat": -16.3650, "lon": -71.5296}).json()
    assert d["zone_id"] == "chilina" and d["in_pilot_zone"] is True
    a = c.post("/api/v1/geometry/area", json={"geometry": MAJES_POLYGON}).json()
    assert a["zone_id"] == "majes"
    centro = c.get("/api/v1/regions/locate", params={"lat": -16.3989, "lon": -71.5369}).json()  # Plaza de Armas
    assert centro["in_pilot_zone"] is False and centro["zone_id"] is None
