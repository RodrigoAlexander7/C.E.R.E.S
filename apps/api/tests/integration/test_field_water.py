"""Contrato HTTP de campo confirmado, agua cualitativa y antecedentes; PostgreSQL real."""

from copy import deepcopy
import hashlib
import json

import pytest

from ceres.infrastructure.geometry import geodesic_area_ha
from ceres.infrastructure.nutrition import load_nutrition
from tests.conftest import MAJES_POLYGON, create_parcel, profile, register
from tests.integration.test_zones import CHILINA_POLYGON

pytestmark = pytest.mark.db

FIELDS = [
    pytest.param(("majes", MAJES_POLYGON, "maiz_grano", "040520"), id="majes"),
    pytest.param(("chilina", CHILINA_POLYGON, "papa", "040102"), id="chilina"),
]
AVAILABILITY = [
    pytest.param("muy_poca", None, 0.35, id="muy_poca"),
    pytest.param("poca", 0.35, 0.65, id="poca"),
    pytest.param("media", 0.65, 1.0, id="media"),
    pytest.param("alta", 1.0, 1.35, id="alta"),
    pytest.param("no_es_problema", 1.35, None, id="no_es_problema"),
]


@pytest.fixture(params=FIELDS)
def field(request):
    zone_id, geometry, crop_id, district_code = request.param
    return {"zone_id": zone_id, "geometry": geometry, "crop_id": crop_id, "district_code": district_code}


def quick_body(field, **changes):
    return {
        "geometry": deepcopy(field["geometry"]),
        "zone_id": field["zone_id"],
        "profile": profile(current_crop_id=field["crop_id"], current_status="cosechado", **changes),
    }


def compare(client, body):
    response = client.post("/api/v1/public/quick-compare", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_quick_compare_requires_outline_even_with_zone_and_area(make_client, field):
    c = make_client()
    body = quick_body(field)
    del body["geometry"]
    # Ninguno de los antiguos valores por defecto habilita estimaciones sin campo.
    for extra in ({}, {"area_ha": 5}, {"area_ha": geodesic_area_ha(field["geometry"])}):
        response = c.post("/api/v1/public/quick-compare", json={**body, **extra})
        assert response.status_code == 422, response.text
    assert c.post("/api/v1/public/quick-compare", json={**body, "geometry": None}).status_code == 422


def test_quick_compare_rejects_mismatching_zone_or_area(make_client, field):
    c = make_client()
    body = quick_body(field)
    wrong_zone = "chilina" if field["zone_id"] == "majes" else "majes"
    response = c.post("/api/v1/public/quick-compare", json={**body, "zone_id": wrong_zone})
    assert response.status_code == 422 and response.json()["error"]["code"] == "zona_no_coincide"
    area = geodesic_area_ha(field["geometry"])
    response = c.post("/api/v1/public/quick-compare", json={**body, "area_ha": area * 2})
    assert response.status_code == 422 and response.json()["error"]["code"] == "area_no_coincide"
    # Un área declarada coherente se admite; el servidor conserva su cálculo.
    data = compare(c, {**body, "area_ha": area})
    assert data["inputs"]["area_ha"] == pytest.approx(area)


def test_outline_resolves_and_freezes_actual_area_hash_and_location(make_client, field):
    c = make_client()
    body = quick_body(field)
    del body["zone_id"]  # La zona se resuelve del contorno, sin preferencia implícita por Majes.
    data = compare(c, body)
    inputs = data["inputs"]
    assert inputs["zone_id"] == field["zone_id"] and inputs["in_pilot_zone"] is True
    assert inputs["field_verified"] is True
    context = inputs["field_context"]
    assert context["verified"] is True and context["area_origin"] == "geodesica"
    assert context["area_ha"] == inputs["area_ha"] == pytest.approx(geodesic_area_ha(body["geometry"]))
    canonical = json.dumps(body["geometry"], sort_keys=True, separators=(",", ":")).encode()
    assert context["geometry_sha256"] == hashlib.sha256(canonical).hexdigest()
    assert context["district"]["code"] == field["district_code"]
    assert context["zone_id"] == field["zone_id"] and context["in_pilot_zone"] is True
    ring = body["geometry"]["coordinates"][0]
    assert context["centroid"]["lon"] == pytest.approx((ring[0][0] + ring[1][0]) / 2)
    assert context["centroid"]["lat"] == pytest.approx((ring[0][1] + ring[2][1]) / 2)
    assert data["result"]["blocking"] == [] and data["result"]["strategies"]


def test_point_only_run_blocks_estimates_despite_declared_pilot_area(make_client, field):
    c = make_client()
    register(c)
    ring = field["geometry"]["coordinates"][0]
    point = {"lon": (ring[0][0] + ring[1][0]) / 2, "lat": (ring[0][1] + ring[2][1]) / 2}
    response = c.post("/api/v1/parcels", json={"point": point, "area_ha": 5, "profile": quick_body(field)["profile"]})
    assert response.status_code == 201, response.text
    parcel = response.json()
    assert parcel["zone_id"] == field["zone_id"] and parcel["in_pilot_zone"] is True
    response = c.post(f"/api/v1/parcels/{parcel['id']}/recommendations", json={})
    assert response.status_code == 201, response.text
    run = response.json()
    assert run["inputs"]["field_verified"] is False
    assert run["inputs"]["field_context"]["geometry_sha256"] is None
    assert run["result"]["blocking"] and run["result"]["strategies"] == []
    assert run["result"]["associations"] == [] and run["result"]["optimizer"] is None
    assert run["statuses"] == {} and run["result"]["ordering"]["ranked"] == []
    assert run["dataset_snapshot_id"] is None and run["dataset_sha256"] is None
    assert c.get(f"/api/v1/recommendations/{run['id']}/reproduce").json()["identical"] is True


@pytest.mark.parametrize("availability,lo,hi", AVAILABILITY)
@pytest.mark.parametrize("use_defaults", [True, False], ids=["defaults", "no_defaults"])
def test_qualitative_water_uses_only_own_zone_and_actual_area(make_client, field, availability, lo, hi, use_defaults):
    c = make_client()
    declared = {"mode": "no_se", "availability": availability}
    data = compare(c, quick_body(field, water=declared, use_zone_defaults=use_defaults))
    inputs = data["inputs"]
    effective = inputs["effective_profile"]["water"]
    assert inputs["profile"]["water"]["availability"] == availability
    assert inputs["profile"]["water"]["mode"] == "no_se"
    assert inputs["profile"]["water"]["allocation_m3"] is None
    assert inputs["profile"]["water"]["allocation_min_m3"] is None
    assert inputs["profile"]["water"]["allocation_max_m3"] is None
    assert effective["mode"] == "no_se" and effective["allocation_m3"] is None
    assert data["result"]["strategies"]
    assert all(s["simple"]["level"] != "buena" for s in data["result"]["strategies"])
    if not use_defaults:
        assert inputs["assumed"] == []
        assert effective["allocation_min_m3"] is None and effective["allocation_max_m3"] is None
        assert effective["efficiency"] is None
        return
    own = c.container.zone(field["zone_id"]).data["water_m3_ha_year"]
    monthly = own["value"] / 12 * geodesic_area_ha(field["geometry"])
    assert effective["allocation_min_m3"] == (None if lo is None else pytest.approx(monthly * lo, abs=0.0001))
    assert effective["allocation_max_m3"] == (None if hi is None else pytest.approx(monthly * hi, abs=0.0001))
    assert set(inputs["assumed"]) == {"water.allocation", "water.efficiency"}
    scenario = inputs["water_scenario"]
    assert scenario["availability"] == availability and scenario["kind"] == "supuesto_zona"
    assert scenario["factors"] == [lo, hi] and scenario["reference"] == own
    assert "CERES-AGUA-CUALITATIVA" in scenario["source_ids"] and scenario["limitation"]


@pytest.mark.parametrize("water", [
    {"mode": "conozco", "allocation_m3": 12345, "efficiency": 0.85, "availability": "poca"},
    {"mode": "no_se", "allocation_min_m3": 1234, "allocation_max_m3": 5678, "efficiency": 0.85, "availability": "alta"},
], ids=["exact", "bounds"])
def test_qualitative_choice_does_not_replace_declared_water(make_client, field, water):
    data = compare(make_client(), quick_body(field, water=water))
    assert "water.allocation" not in data["inputs"]["assumed"]
    for key in ("mode", "allocation_m3", "allocation_min_m3", "allocation_max_m3", "efficiency"):
        assert data["inputs"]["effective_profile"]["water"][key] == data["inputs"]["profile"]["water"][key]


@pytest.mark.parametrize("invalid", ["buena", "abundante", 5])
def test_availability_rejects_values_outside_five_choices(make_client, invalid):
    c = make_client()
    response = c.post("/api/v1/public/quick-compare", json={
        "geometry": MAJES_POLYGON,
        "profile": profile(water={"mode": "no_se", "availability": invalid}),
    })
    assert response.status_code == 422, response.text


def test_actual_area_scales_water_bounds_demand_and_available_economics(make_client, field):
    c = make_client()
    full_body = quick_body(field, water={"mode": "no_se", "availability": "media"})
    half_body = deepcopy(full_body)
    ring = half_body["geometry"]["coordinates"][0]
    middle = (ring[0][0] + ring[1][0]) / 2
    ring[1][0] = ring[2][0] = middle
    full, half = compare(c, full_body), compare(c, half_body)
    ratio = full["inputs"]["area_ha"] / half["inputs"]["area_ha"]
    assert ratio == pytest.approx(2, rel=0.00001)
    assert full["inputs"]["field_context"]["geometry_sha256"] != half["inputs"]["field_context"]["geometry_sha256"]
    for bound in ("allocation_min_m3", "allocation_max_m3"):
        assert full["inputs"]["effective_profile"]["water"][bound] == pytest.approx(
            half["inputs"]["effective_profile"]["water"][bound] * ratio, abs=0.0003,
        )
    a_full = next(s for s in full["result"]["strategies"] if s["strategy_id"] == "A")
    a_half = next(s for s in half["result"]["strategies"] if s["strategy_id"] == "A")
    assert a_full["timeline"] == a_half["timeline"] and a_full["sequence"]
    assert a_full["metrics"]["A.agua.bruto_m3"]["value"] == pytest.approx(
        a_half["metrics"]["A.agua.bruto_m3"]["value"] * ratio, abs=0.001,
    )
    if field["zone_id"] == "majes":
        assert a_full["metrics"]["A.eco.margen"]["value"] == pytest.approx(
            a_half["metrics"]["A.eco.margen"]["value"] * ratio, abs=0.001,
        )
    else:
        assert a_full["simple"]["facts"]["margin_soles"] is None
        assert a_half["simple"]["facts"]["margin_soles"] is None


@pytest.mark.parametrize("streak", ["omitted", None, 1, 2], ids=["omitted", "unknown", "one", "two"])
def test_timeline_never_exceeds_two_consecutive_sowings_including_previous(make_client, field, streak):
    c = make_client()
    body = quick_body(field)
    if streak == "omitted":
        del body["profile"]["current_crop_streak"]
    else:
        body["profile"]["current_crop_streak"] = streak
    data = compare(c, body)
    assumed = streak in ("omitted", None)
    previous_streak = 2 if assumed else streak
    assert data["inputs"]["profile"]["current_crop_streak"] == (None if assumed else streak)
    assert ("current_crop_streak" in data["inputs"]["assumed"]) is assumed
    assert data["result"]["strategies"]
    assert any(s["sequence"] for s in data["result"]["strategies"])
    for strategy in data["result"]["strategies"]:
        crop, count = field["crop_id"], previous_streak
        accepted = []
        for block in strategy["timeline"]:
            if block["kind"] != "cultivo":
                continue  # Preparación, espera y descanso no reinician el antecedente.
            count = count + 1 if block["crop_id"] == crop else 1
            crop = block["crop_id"]
            accepted.append(crop)
            assert count <= 2, (strategy["strategy_id"], strategy["timeline"])
        assert accepted == strategy["sequence"]
    a = next(s for s in data["result"]["strategies"] if s["strategy_id"] == "A")
    assert len(a["sequence"]) == 2 - previous_streak
    assert any(r["rule_id"] == "ANT-02" for r in a["reasons"])
    if previous_streak == 2:
        assert a["status"] == "no_viable" and a["metrics"] == {}
        assert a["simple"]["facts"]["water_m3"] is None
        assert a["simple"]["facts"]["margin_soles"] is None
        assert "A" not in data["result"]["ordering"]["ranked"]


def test_polyculture_remains_exploratory_without_water_or_economic_numbers(make_client, field):
    c = make_client()
    data = compare(c, quick_body(field))
    associations = data["result"]["associations"]
    assert associations
    local = c.container.zone(field["zone_id"]).catalog.associations
    assert [card["id"] for card in associations] == [candidate.id for candidate in local]
    for candidate, card in zip(local, associations, strict=True):
        assert card["components"] == list(candidate.components)
        assert card["source_ids"] == list(candidate.source_ids)
        assert card["type"] == "policultivo" and card["status"] == "exploratoria"
        assert all(card[key] is None for key in ("water_m3", "margin_soles", "density_plants_ha", "advantage"))
        assert card["missing"] and card["source_ids"] and card["warning"]
        assert card["id"] not in data["result"]["ordering"]["ranked"]


def test_saved_run_freezes_field_profile_water_and_nutrition(make_client, field, monkeypatch):
    c = make_client()
    register(c)
    zone = c.container.zone(field["zone_id"])
    nutrition = load_nutrition(c.container.settings.data_dir / "nutricion" / "arequipa_context.json")
    monkeypatch.setitem(zone.extra, "nutrition", nutrition)
    body = quick_body(field, water={"mode": "no_se", "availability": "media"})
    response = c.post("/api/v1/parcels", json={"geometry": body["geometry"], "profile": body["profile"]})
    assert response.status_code == 201, response.text
    pid = response.json()["id"]
    response = c.post(f"/api/v1/parcels/{pid}/recommendations", json={})
    assert response.status_code == 201, response.text
    first = response.json()
    assert first["inputs"]["field_verified"] is True
    assert first["inputs"]["field_context"]["geometry_sha256"]
    assert first["inputs"]["nutrition_context"] == nutrition
    assert first["inputs"]["nutrition_context"]["integrity"]["workbook_sha256_verified"] is True
    assert first["result"]["strategies"]
    for strategy in first["result"]["strategies"]:
        regional = strategy["nutrition"]["regional_context"]
        assert regional["source"] == nutrition["source"]
        assert regional["integrity"] == nutrition["integrity"]
        for actual, expected in zip(regional["indicators"], nutrition["indicators"], strict=True):
            assert actual["id"] == expected["id"]
            assert actual["count"] == expected["count"] and actual["denominator"] == expected["denominator"]
            assert actual["percent"] == pytest.approx(expected["percent"], abs=0.0001)
    changed_profile = {**body["profile"], "priority": "suelo", "current_crop_streak": 2,
                       "water": {"mode": "no_se", "availability": "poca"}}
    response = c.post(f"/api/v1/parcels/{pid}/profile-revisions", json={"profile": changed_profile})
    assert response.status_code == 201, response.text
    changed_geometry = deepcopy(body["geometry"])
    ring = changed_geometry["coordinates"][0]
    ring[1][0] = ring[2][0] = (ring[0][0] + ring[1][0]) / 2
    response = c.patch(f"/api/v1/parcels/{pid}", json={"geometry": changed_geometry})
    assert response.status_code == 200, response.text
    # Una actualización del contexto cargado tampoco altera la reproducción del run guardado.
    monkeypatch.setitem(zone.extra, "nutrition", None)
    old = c.get(f"/api/v1/recommendations/{first['id']}").json()
    assert old["profile_changed"] is True
    assert old["inputs"] == first["inputs"] and old["result"] == first["result"]
    assert c.get(f"/api/v1/recommendations/{first['id']}/reproduce").json() == {"same_versions": True, "identical": True}
    response = c.post(f"/api/v1/parcels/{pid}/recommendations", json={})
    assert response.status_code == 201, response.text
    second = response.json()
    assert second["id"] != first["id"] and second["profile_changed"] is False
    assert second["inputs"]["profile"]["water"]["availability"] == "poca"
    assert second["inputs"]["profile"]["current_crop_streak"] == 2
    assert second["inputs"]["area_ha"] < first["inputs"]["area_ha"]
    assert second["inputs"]["field_context"]["geometry_sha256"] != first["inputs"]["field_context"]["geometry_sha256"]
    assert second["inputs"]["nutrition_context"] is None


def add_campaign(client, pid, **data):
    response = client.post(f"/api/v1/parcels/{pid}/notebook", json={
        "data": {"kind": "campana", "crop_id": "maiz_grano", **data},
    })
    assert response.status_code == 201, response.text
    return response.json()


def saved_run(client, pid):
    response = client.post(f"/api/v1/parcels/{pid}/recommendations", json={})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("declared_streak", [1, None], ids=["declared_one", "unknown"])
def test_notebook_history_overrides_low_streak_deduplicates_and_freezes(make_client, declared_streak):
    c = make_client()
    register(c)
    pid = create_parcel(c, current_status="cosechado", current_crop_streak=declared_streak)["id"]
    first_crop = add_campaign(c, pid, sowing_date="2023-01-01", variety="Amarillo")
    duplicate = add_campaign(c, pid, sowing_date="2023-01-01", variety="Otra variedad")
    add_campaign(c, pid, sowing_date="2024-01-01", evidence="simulado_demo")
    add_campaign(c, pid, crop_id="frejol_grano", sowing_date="2026-10-01", evidence="simulado_demo")
    add_campaign(c, pid, sowing_date="2027-01-01")
    add_campaign(c, pid, crop_id="frejol_grano")  # Sin fecha no aporta evidencia de cambio.
    before = saved_run(c, pid)
    history = before["inputs"]["crop_history"]
    assert history["streak"] == 1  # Variedades de la misma fecha son una sola siembra.
    assert set(history["record_ids"]) == {first_crop["id"], duplicate["id"]}
    assert history["source_ids"] == ["CUADERNO"]
    assert before["inputs"]["profile"]["current_crop_streak"] == declared_streak
    assert before["inputs"]["effective_profile"]["current_crop_streak"] == (declared_streak or 2)
    assert ("current_crop_streak" in before["inputs"]["assumed"]) is (declared_streak is None)
    # El lapso sin siembra entre campañas no reinicia la racha.
    second_crop = add_campaign(c, pid, sowing_date="2026-03-01")
    after = saved_run(c, pid)
    history = after["inputs"]["crop_history"]
    assert history["streak"] == 2
    assert set(history["record_ids"]) == {first_crop["id"], duplicate["id"], second_crop["id"]}
    assert history["source_ids"] == ["CUADERNO"]
    assert after["inputs"]["profile"]["current_crop_streak"] == declared_streak
    assert after["inputs"]["effective_profile"]["current_crop_streak"] == 2
    assert "current_crop_streak" not in after["inputs"]["assumed"]
    a = next(s for s in after["result"]["strategies"] if s["strategy_id"] == "A")
    assert a["status"] == "no_viable" and a["sequence"] == [] and a["metrics"] == {}
    assert any(r["rule_id"] == "ANT-02" for r in a["reasons"])
    old = c.get(f"/api/v1/recommendations/{before['id']}").json()
    assert old["inputs"] == before["inputs"] and old["result"] == before["result"]
    assert c.get(f"/api/v1/recommendations/{before['id']}/reproduce").json() == {"same_versions": True, "identical": True}


def test_latest_mixed_campaign_date_leaves_history_unknown(make_client):
    c = make_client()
    register(c)
    pid = create_parcel(c, current_status="cosechado", current_crop_streak=None)["id"]
    add_campaign(c, pid, sowing_date="2025-01-01")
    add_campaign(c, pid, sowing_date="2026-03-01")
    add_campaign(c, pid, sowing_date="2026-10-01")
    add_campaign(c, pid, crop_id="frejol_grano", sowing_date="2026-10-01")
    run = saved_run(c, pid)
    assert run["inputs"]["crop_history"]["streak"] is None
    assert run["inputs"]["crop_history"]["record_ids"] == []
    assert "current_crop_streak" in run["inputs"]["assumed"]
    a = next(s for s in run["result"]["strategies"] if s["strategy_id"] == "A")
    assert a["sequence"] == [] and a["status"] == "no_viable"


def test_sowing_event_increments_and_caps_streak_harvest_preserves_change_resets(make_client):
    c = make_client()
    register(c)
    pid = create_parcel(c)["id"]

    def event(crop, status, **extra):
        response = c.post(f"/api/v1/parcels/{pid}/crop-events", json={
            "crop_id": crop, "status": status, **extra,
        })
        assert response.status_code == 201, response.text
        return response.json()["new_revision"]["profile"]

    harvested = event("maiz_grano", "cosechado", actual_harvest="2026-11-01")
    assert harvested["current_crop_streak"] == 1 and harvested["current_status"] == "cosechado"
    sown = event("maiz_grano", "en_campo", sowing_date="2026-11-02", expected_harvest="2027-04-01")
    assert sown["current_crop_streak"] == 2 and sown["current_status"] == "en_campo"
    harvested = event("maiz_grano", "cosechado", actual_harvest="2027-04-01")
    assert harvested["current_crop_streak"] == 2
    capped = event("maiz_grano", "en_campo", sowing_date="2027-04-02", expected_harvest="2027-10-01")
    assert capped["current_crop_streak"] == 2
    rotated = event("frejol_grano", "en_campo", sowing_date="2027-04-03", expected_harvest="2027-08-01")
    assert rotated["current_crop_streak"] == 1 and rotated["current_crop_id"] == "frejol_grano"
