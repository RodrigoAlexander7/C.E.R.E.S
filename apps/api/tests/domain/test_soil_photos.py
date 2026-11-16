"""Pruebas aisladas: no PostgreSQL, fotos privadas ni llamadas de red/LLM."""

import asyncio
import base64
import json
import struct
import zlib
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from ceres.application.errors import ApiError
from ceres.application.ports import LlmRequest, LlmResult
from ceres.config import Settings
from ceres.infrastructure.llm.gemini import GeminiModel
from ceres.infrastructure.llm.openai_responses import OpenAIResponsesModel
from ceres.infrastructure.security import RateLimiter
from ceres.presentation import soil_photos as photos

OBSERVATION = {"salinity_signs": "no_concluyente", "description": "La superficie está desenfocada.", "limitations": "No se distingue el suelo con suficiente detalle."}
PRIVATE_METADATA = b"EXIF GPS metadata-private"


def chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


def png(metadata=False, width=1):
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, 1, 8, 2, 0, 0, 0))
            + (chunk(b"eXIf", PRIVATE_METADATA) + chunk(b"tEXt", PRIVATE_METADATA) if metadata else b"")
            + chunk(b"IDAT", zlib.compress(b"\0\xff\xff\xff")) + chunk(b"IEND", b""))


def jpeg(metadata=False):
    # Contenedor mínimo para comprobar segmentos; no se decodifican píxeles en el servidor.
    def segment(marker, payload):
        return bytes([255, marker]) + struct.pack(">H", len(payload) + 2) + payload
    return (b"\xff\xd8" + (segment(0xE1, PRIVATE_METADATA) + segment(0xFE, PRIVATE_METADATA) if metadata else b"")
            + segment(0xC0, b"\x08\x00\x01\x00\x01\x01\x01\x11\x00")
            + segment(0xDA, b"\x01\x01\x00\x00\x3f\x00") + b"pixel\xff\x00data\xff\xd9")


def webp(metadata=False):
    def part(kind, payload):
        return kind + len(payload).to_bytes(4, "little") + payload + (b"\0" if len(payload) % 2 else b"")
    body = b"WEBP" + part(b"VP8X", bytes([0x0C if metadata else 0]) + b"\0" * 9)
    body += part(b"VP8L", b"\x2f\x00\x00\x00\x00pixel")
    if metadata:
        body += part(b"EXIF", PRIVATE_METADATA) + part(b"XMP ", PRIVATE_METADATA)
    return b"RIFF" + len(body).to_bytes(4, "little") + body


def payload(count=1, data=None, mime="image/png"):
    return {"images": [{"mime": mime, "data_base64": base64.b64encode(data if data is not None else png()).decode()} for _ in range(count)]}


class FakeModel:
    configured = True
    model_name = "test-gemini"

    def __init__(self):
        self.requests = []
        self.result = LlmResult(status="ok", data=dict(OBSERVATION))

    def answer(self, request):
        self.requests.append(request)
        return self.result


@pytest.fixture
def client():
    c = SimpleNamespace(settings=SimpleNamespace(llm_provider="gemini"), llm=FakeModel(), quick_limiter=RateLimiter(60, 600))
    app = FastAPI()
    app.state.container = c
    app.include_router(photos.router)

    @app.exception_handler(ApiError)
    async def error_handler(request, exc):
        return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status)

    with TestClient(app) as client:
        client.c = c
        yield client


@pytest.mark.parametrize("count", [1, 2, 3, 4])
def test_public_assessment_has_exact_contract_and_uncertainty(client, count):
    r = client.post("/api/v1/public/soil-photos", json=payload(count))
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store"
    result = r.json()
    assert set(result) == {"salinity_signs", "description", "limitations", "source"}
    assert result["salinity_signs"] == "no_concluyente"
    assert result["source"] == "gemini_visual"
    assert "no confirma ni descarta" in result["limitations"]
    req = client.c.llm.requests[0]
    assert req.audio is None and len(req.images) == count
    assert req.schema["additionalProperties"] is False
    assert req.schema["properties"]["salinity_signs"]["enum"] == ["con_signos", "sin_signos", "no_concluyente"]


@pytest.mark.parametrize("mime,make", [("image/png", png), ("image/jpeg", jpeg), ("image/webp", webp)])
def test_removes_metadata_and_trailing_data_before_model(client, mime, make):
    data = make(metadata=True)
    if mime != "image/webp":
        data += PRIVATE_METADATA
    r = client.post("/api/v1/public/soil-photos", json=payload(data=data, mime=mime))
    assert r.status_code == 200, r.text
    sent_mime, sent = client.c.llm.requests[0].images[0]
    assert sent_mime == mime and PRIVATE_METADATA not in sent
    assert len(sent) < len(data)
    if mime == "image/webp":
        assert sent[20] & 0x0C == 0  # flags EXIF/XMP retirados


@pytest.mark.parametrize("count", [0, 5])
def test_count_and_no_sensitive_validation_echo(client, count):
    body = payload(count)
    if count:
        body["images"][0]["data_base64"] = "secret-input-never-echo"
    r = client.post("/api/v1/public/soil-photos", json=body)
    assert r.status_code == 422 and "secret-input" not in r.text
    assert not client.c.llm.requests


@pytest.mark.parametrize("body", [
    {"images": [{"mime": "image/gif", "data_base64": "AAAA"}]},
    {"images": [{"mime": "image/png", "data_base64": "!!!!"}]},
    payload(data=b"not-a-photo"), payload(data=jpeg(), mime="image/png"),
    payload(data=png(width=4097)), payload(data=png()[:-1]),
    {**payload(), "transcript": "private"},
])
def test_invalid_upload_never_calls_model(client, body):
    r = client.post("/api/v1/public/soil-photos", json=body)
    assert r.status_code == 422 and not client.c.llm.requests


def test_decoded_budget_enforced(client, monkeypatch):
    monkeypatch.setattr(photos, "MAX_IMAGE_BYTES", len(png()) + 1)
    r = client.post("/api/v1/public/soil-photos", json=payload(2))
    assert r.status_code == 413 and not client.c.llm.requests


def test_declared_body_budget_precedes_json_parsing(client):
    r = client.post("/api/v1/public/soil-photos", content=b"{}", headers={"content-type": "application/json", "content-length": str(photos.MAX_BODY_BYTES + 1)})
    assert r.status_code == 413 and not client.c.llm.requests


def test_stream_without_content_length_stops_at_limit(monkeypatch):
    monkeypatch.setattr(photos, "MAX_BODY_BYTES", 64)
    chunks = iter([b"a" * 40, b"b" * 40, b"NEVER READ"])
    consumed = []

    async def receive():
        data = next(chunks)
        consumed.append(data)
        return {"type": "http.request", "body": data, "more_body": True}

    request = Request({"type": "http", "method": "POST", "path": "/", "headers": [(b"content-type", b"application/json")]}, receive)
    with pytest.raises(ApiError) as error:
        asyncio.run(photos.soil_photos(request, Response(), SimpleNamespace(quick_limiter=None)))
    assert error.value.status == 413 and len(consumed) == 2


def test_json_content_type_and_malformed_body(client):
    assert client.post("/api/v1/public/soil-photos", content=b"{}").status_code == 415
    assert client.post("/api/v1/public/soil-photos", content=b"{broken", headers={"content-type": "application/json"}).status_code == 422
    assert not client.c.llm.requests


def test_uses_existing_rate_limiter(client):
    client.c.quick_limiter = RateLimiter(1, 600)
    assert client.post("/api/v1/public/soil-photos", json=payload()).status_code == 200
    assert client.post("/api/v1/public/soil-photos", json=payload()).status_code == 429
    assert len(client.c.llm.requests) == 1


@pytest.mark.parametrize("category,code", [("quota", "ia_sin_cuota"), ("timeout", "ia_timeout"), ("configuration", "ia_configuracion")])
def test_reuses_llm_failure_without_leaking_provider_output(client, category, code, caplog):
    client.c.llm.result = LlmResult(status="error_proveedor", error_code=category, error="private-provider-input")
    r = client.post("/api/v1/public/soil-photos", json=payload())
    assert r.status_code == 503 and r.json()["error"]["code"] == code
    assert "private-provider-input" not in r.text + caplog.text


@pytest.mark.parametrize("data", [None, [], {**OBSERVATION, "salinity_signs": "desconocido"},
    {**OBSERVATION, "ece_ds_m": 0}, {**OBSERVATION, "description": "pH alto."},
    {**OBSERVATION, "description": "Salinidad de 2 dS/m."},
    {**OBSERVATION, "limitations": "Potasio alto."},
    {**OBSERVATION, "description": "No hay sal."}, {**OBSERVATION, "limitations": " "},
])
def test_rejects_invalid_or_invented_assessments(client, data):
    client.c.llm.result = LlmResult(status="ok", data=data)
    assert client.post("/api/v1/public/soil-photos", json=payload()).status_code == 502


def test_no_signs_is_not_absence_of_salinity(client):
    client.c.llm.result = LlmResult(status="ok", data={**OBSERVATION, "salinity_signs": "sin_signos", "description": "No se aprecian costras en el suelo visible."})
    r = client.post("/api/v1/public/soil-photos", json=payload())
    assert r.status_code == 200 and "no confirma ni descarta" in r.json()["limitations"]


@pytest.mark.parametrize("provider,configured", [("openai", True), (None, False), ("gemini", False)])
def test_requires_configured_gemini(client, provider, configured):
    client.c.settings.llm_provider = provider
    client.c.llm.configured = configured
    assert client.post("/api/v1/public/soil-photos", json=payload()).status_code == 503
    assert not client.c.llm.requests


def test_gemini_sends_all_images_with_audio_without_network():
    settings = Settings(_env_file=None, gemini_api_key=None, gemini_model="test-model")
    model = GeminiModel(settings)
    calls = []

    def generate(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(text=json.dumps(OBSERVATION), model_version="test-model")

    model._client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    images = [("image/png", png()), ("image/jpeg", jpeg())]
    result = model.answer(LlmRequest(system="test", context_json="{}", question="observa", images=images, audio=b"audio", audio_mime="audio/ogg"))
    assert result.status == "ok"
    parts = [part.inline_data for content in calls[0]["contents"] for part in content.parts if part.inline_data]
    assert [(part.mime_type, part.data) for part in parts] == [("audio/ogg", b"audio"), *images]
    assert LlmRequest(system="", context_json="", question="").images == []


def test_openai_explicitly_rejects_images_without_network():
    model = OpenAIResponsesModel(Settings(_env_file=None, openai_api_key=None, openai_model=None))
    result = model.answer(LlmRequest(system="test", context_json="{}", question="observa", images=[("image/png", png())]))
    assert result.status == "error_proveedor" and result.error_code == "unsupported_images"


def test_gemini_quota_is_safe_with_images_and_no_network(caplog):
    settings = Settings(_env_file=None, gemini_api_key=None, gemini_model="test-model", gemini_fallback_model="test-fallback")
    model = GeminiModel(settings)
    calls = []

    class FakeQuota(Exception):
        code = 429

    def generate(**kwargs):
        calls.append(kwargs["model"])
        raise FakeQuota("PRIVATE photo bytes and provider details")

    model._client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    request = LlmRequest(system="test", context_json="{}", question="observa", images=[("image/png", png(metadata=True))])
    result = model.answer(request)
    assert result.status == "error_proveedor" and result.error_code == "quota"
    assert calls == ["test-model", "test-fallback"]
    assert "PRIVATE" not in (result.error or "") + caplog.text
    assert "images=" not in repr(request)
