"""Contexto congelado y citas del asistente, con LLM falso y sin base de datos."""

import json
from copy import deepcopy
from pathlib import Path

import pytest

from ceres.application.assistant import answer_question, build_context
from ceres.domain.nutrition import (
    FAO_PULSES_SOURCE_ID,
    HIS_SOURCE_ID,
    INS_FOOD_SOURCE_ID,
    nutrition_impact,
)
from ceres.infrastructure.llm.fake import FakeLanguageModel


@pytest.fixture
def sources(base_settings):
    data = json.loads((base_settings.data_dir / "sources" / "sources.json").read_text())
    return {s["id"]: s for s in data["sources"]}


@pytest.fixture
def run():
    # Contexto sintético que representa lo ya congelado al crear el resultado.
    regional = {
        "region": "Arequipa", "region_code": "04", "kind": "contexto_vigilancia_humana",
        "population": "Adolescentes evaluados en establecimientos de salud",
        "period": {"start": "2026-01-01", "end": "2026-08-31"},
        "source_ids": [HIS_SOURCE_ID],
        "indicators": [{"id": "anemia_total", "count": 180, "denominator": 600, "percent": 30.0}],
        "limitations": ["No es una muestra poblacional ni demuestra causalidad."],
    }
    nutrition = nutrition_impact(["maiz_grano", "frejol_grano"], regional)
    return {
        "id": "run-propio", "created_at": "2026-11-15", "scenario_label": "Base",
        "inputs": {
            "nutrition_context": deepcopy(regional),
            "water_scenario": {
                "availability": "poca", "kind": "supuesto_zona",
                "source_ids": ["CERES-AGUA-CUALITATIVA"],
                "method": "Escenario CERES según disponibilidad declarada",
                "limitation": "Intervalo supuesto, sin equivalencia medida.",
            },
            "field_context": {"geometry": {"coordinates": [[-72.1911, -16.351]]}},
            "profile": {"soil": {"photo_assessment": {"image_base64": "FOTO-PRIVADA"}}},
        },
        "result": {
            "priority": "equilibrada", "horizon_start": "2026-11-15", "horizon_end": "2027-11-15",
            "engine_version": "prueba", "catalog_version": "prueba", "ordering": {"ranked": ["B"]},
            "strategies": [{
                "strategy_id": "B", "name": "Rotación", "status": "viable_con_supuestos",
                "sequence": ["maiz_grano", "frejol_grano"], "summary": "Alterna cultivos.",
                "timeline": [], "metrics": {
                    "B.eco.margen": {
                        "label": "Margen", "value": 27000.0, "unit": "S/", "kind": "supuesto_demo",
                        "method": "Ejemplo", "source_ids": ["DEMO-ECONOMIA"],
                    },
                },
                "reasons": [{
                    "rule_id": "ROT", "state": "cumple", "message": "Alterna familias.",
                    "metric_ids": [], "source_ids": ["UNSA-MAJES"], "missing": [],
                }],
                "assumptions": [], "missing": [], "nutrition": nutrition,
            }],
            "associations": [{
                "id": "maiz_frejol_asociado", "source_ids": ["FAO56-KC"],
                "nutrition": deepcopy(nutrition),
            }],
        },
    }


def context(run, sources, summary=None):
    return build_context(run, summary or {"area_ha": 2.5, "zona_piloto": "Majes I"}, [], sources, False)


def nutrition_answer(req):
    payload = json.loads(req.context_json)
    nutrition = payload["resultado"]["estrategias"][0]["nutrition"]
    indicator = nutrition["regional_context"]["indicators"][0]
    return {
        "answer": (
            f"En el contexto HIS de Arequipa hay {indicator['count']} evaluados con anemia "
            f"de {indicator['denominator']}, equivalentes al {indicator['percent']} %. "
            "El frejol tiene un aporte alimentario potencial; sembrarlo no prueba una mejora de salud."
        ),
        "detail": nutrition["explanation"], "metric_ids": [],
        "source_ids": [INS_FOOD_SOURCE_ID, FAO_PULSES_SOURCE_ID, HIS_SOURCE_ID],
        "assumptions": [], "missing_data": [],
    }


def ask(llm, ctx, run):
    return answer_question(llm, ctx, "¿Qué aporte alimentario tiene la rotación?", [], run, [])


def test_strategy_nutrition_and_association_sources_are_authorized(run, sources):
    ctx = context(run, sources)
    result = ctx.payload["resultado"]
    assert result["estrategias"][0]["nutrition"] == run["result"]["strategies"][0]["nutrition"]
    assert result["asociaciones"] == run["result"]["associations"]
    assert {
        INS_FOOD_SOURCE_ID, FAO_PULSES_SOURCE_ID, HIS_SOURCE_ID, "FAO56-KC",
        "DEMO-ECONOMIA", "UNSA-MAJES", "CERES-AGUA-CUALITATIVA", "MOTOR",
    } <= ctx.source_ids
    assert "CERES-BASE-MAESTRA-NUTRICION-2026" not in ctx.source_ids  # registrada, pero no utilizada


def test_nested_nutrition_sources_and_association_only_nutrition(run, sources):
    run["result"]["strategies"][0]["nutrition"] = None
    nutrition = run["result"]["associations"][0]["nutrition"]
    nutrition["source_ids"] = []  # conserva referencias explícitas en alimentos y contexto humano
    ctx = context(run, sources)
    assert {INS_FOOD_SOURCE_ID, HIS_SOURCE_ID, "FAO56-KC"} <= ctx.source_ids
    assert FAO_PULSES_SOURCE_ID not in ctx.source_ids  # ya no hay una referencia a esta fuente


def test_fake_accepts_registered_nutrition_citations_and_frozen_figures(run, sources):
    llm = FakeLanguageModel(nutrition_answer)
    result = ask(llm, context(run, sources), run)
    assert result.status == "ok"
    assert set(result.source_ids) == {INS_FOOD_SOURCE_ID, FAO_PULSES_SOURCE_ID, HIS_SOURCE_ID}
    assert len(llm.requests) == 1
    assert "separado de la fertilidad del suelo" in llm.requests[0].system
    assert "No infieras reducciones de anemia" in llm.requests[0].system
    assert "No representa a toda la población" in llm.requests[0].system
    assert llm.requests[0].images == []


@pytest.mark.parametrize("change,problem", [
    ({"source_ids": ["INS-FUENTE-INVENTADA"]}, "fuentes que no están"),
    ({"source_ids": ["CERES-BASE-MAESTRA-NUTRICION-2026"]}, "fuentes que no están"),
    ({"answer": "Aportará 987654321 gramos de hierro."}, "cifras sin respaldo"),
    ({"detail": "La proporción fue 43.21 %."}, "cifras sin respaldo"),
    ({"metric_ids": ["B.nutrition.beneficio_clinico"]}, "métricas inexistentes"),
])
def test_fake_rejects_unbacked_nutrition_then_falls_back(run, sources, change, problem):
    def bad(req):
        return {**nutrition_answer(req), **change}

    llm = FakeLanguageModel(bad)
    result = ask(llm, context(run, sources), run)
    assert result.status == "respuesta_no_validada"
    assert len(llm.requests) == 2
    assert any(problem in p for p in result.validation_problems)
    assert problem in llm.requests[1].feedback
    assert result.detail == "Rotación: viable con supuestos. Alterna cultivos."
    assert "987654321" not in result.content + result.detail


def test_fake_rejects_nutrition_id_absent_from_authorized_registry(run, sources):
    # Aunque el resultado lo referencia, el registro filtrado por propietario no lo autoriza.
    sources.pop(HIS_SOURCE_ID)
    llm = FakeLanguageModel(nutrition_answer)
    ctx = context(run, sources)
    assert HIS_SOURCE_ID not in ctx.source_ids
    result = ask(llm, ctx, run)
    assert result.status == "respuesta_no_validada"
    assert any(HIS_SOURCE_ID in p for p in result.validation_problems)


def test_two_authorized_contexts_do_not_share_private_nutrition_or_citations(run, sources):
    other = deepcopy(run)
    other["id"] = "run-otra-cuenta"
    private_id = "NUTRICION-PRIVADA-OTRA-CUENTA"
    regional = other["result"]["strategies"][0]["nutrition"]["regional_context"]
    regional["indicators"] = [{"id": "privado", "count": 87654321}]
    regional["source_ids"] = [private_id]
    other_sources = {**sources, private_id: {
        "title": "Informe privado ajeno", "institution": "Otra cuenta", "kind": "declarado",
    }}
    other_ctx = context(other, other_sources)
    own_ctx = context(run, sources)
    assert private_id in other_ctx.source_ids
    assert private_id not in own_ctx.source_ids

    def resp(req):
        assert "87654321" not in req.context_json
        assert "Informe privado ajeno" not in req.context_json
        assert private_id not in req.context_json
        return {**nutrition_answer(req), "source_ids": [private_id], "answer": "Hay 87654321 evaluados."}

    llm = FakeLanguageModel(resp)
    result = ask(llm, own_ctx, run)
    assert result.status == "respuesta_no_validada"
    assert any("fuentes que no están" in p for p in result.validation_problems)
    assert any("cifras sin respaldo" in p for p in result.validation_problems)


def test_context_keeps_frozen_nutrition_and_water_without_reading_files(run, sources, monkeypatch):
    frozen = deepcopy(run)

    def no_file_reads(*args, **kwargs):
        pytest.fail("El asistente no debe leer la instantánea nutricional actual")

    monkeypatch.setattr(Path, "read_text", no_file_reads)
    monkeypatch.setattr(Path, "read_bytes", no_file_reads)
    ctx = context(frozen, sources)
    # Cambiar otro snapshot o los objetos de entrada no cambia lo que recibe el LLM.
    run["inputs"]["nutrition_context"]["indicators"][0]["count"] = 777777
    frozen["result"]["strategies"][0]["nutrition"]["regional_context"]["indicators"][0]["count"] = 888888
    frozen["inputs"]["water_scenario"]["availability"] = "alta"
    assert ctx.payload["resultado"]["escenario_agua"]["availability"] == "poca"
    llm = FakeLanguageModel(nutrition_answer)
    assert ask(llm, ctx, frozen).status == "ok"
    assert "180" in llm.requests[0].context_json
    assert "777777" not in llm.requests[0].context_json
    assert "888888" not in llm.requests[0].context_json


def test_context_excludes_photos_and_exact_geometry_from_summary_and_inputs(run, sources):
    summary = {
        "area_ha": 2.5, "zona_piloto": "Majes I", "area_origen": "poligono",
        "geometry": {"coordinates": [[-72.1911, -16.351]]},
        "coordinates": [-72.1911, -16.351], "image_base64": "FOTO-PRIVADA",
        "perfil_usado": {
            "soil": {"ece_ds_m": 0.9, "salinity_signs": "sin_signos",
                     "photo_assessment": {"image_base64": "FOTO-PRIVADA"}},
            "water": {"availability": "poca", "mode": "no_se", "coordinates": [-72.1911]},
            "photos": ["FOTO-PRIVADA"], "geometry": {"coordinates": [[-72.1911]]},
        },
    }
    ctx = context(run, sources, summary)
    llm = FakeLanguageModel(nutrition_answer)
    assert ask(llm, ctx, run).status == "ok"
    raw = llm.requests[0].context_json
    assert all(token not in raw for token in ("FOTO-PRIVADA", "geometry", "coordinates", "-72.1911", "photo_assessment"))
    assert ctx.payload["parcela"]["area_ha"] == 2.5
    assert ctx.payload["parcela"]["perfil_usado"]["soil"]["ece_ds_m"] == 0.9
    assert ctx.payload["resultado"]["escenario_agua"] == run["inputs"]["water_scenario"]
    assert "dotación medida" in llm.requests[0].system
    assert summary["perfil_usado"]["soil"]["photo_assessment"]  # no muta las entradas


@pytest.mark.parametrize("value", [None, "absent"])
def test_old_run_without_nutrition_or_water_snapshot_is_supported(run, sources, value):
    strategy = run["result"]["strategies"][0]
    if value == "absent":
        strategy.pop("nutrition")
    else:
        strategy["nutrition"] = value
    run.pop("inputs")
    run["result"]["associations"] = []
    ctx = context(run, sources)
    assert ctx.payload["resultado"]["estrategias"][0]["nutrition"] is None
    assert ctx.payload["resultado"]["escenario_agua"] is None
    assert not {INS_FOOD_SOURCE_ID, FAO_PULSES_SOURCE_ID, HIS_SOURCE_ID} & ctx.source_ids
