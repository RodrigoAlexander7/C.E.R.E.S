"""Selección del proveedor LLM por configuración (sin llamadas de red)."""

from ceres.config import Settings
from ceres.infrastructure.llm.factory import build_language_model, check_connection
from ceres.infrastructure.llm.gemini import GeminiModel
from ceres.infrastructure.llm.openai_responses import OpenAIResponsesModel
from ceres.application.ports import LlmRequest

BASE = {"_env_file": None}


def test_gemini_is_preferred_and_mode_alias_accepted(monkeypatch):
    for k in ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_MODE", "OPENAI_API_KEY", "OPENAI_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-falsa")
    monkeypatch.setenv("GEMINI_MODE", "modelo-x")
    monkeypatch.setenv("OPENAI_API_KEY", "otra")
    monkeypatch.setenv("OPENAI_MODEL", "m")
    s = Settings(**BASE)
    assert s.gemini_model == "modelo-x" and s.llm_provider == "gemini"
    m = build_language_model(s)
    assert isinstance(m, GeminiModel) and m.configured and m.model_name == "modelo-x"


def test_openai_fallback_and_unconfigured(monkeypatch):
    for k in ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_MODE", "OPENAI_API_KEY", "OPENAI_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "x")
    monkeypatch.setenv("OPENAI_MODEL", "m")
    assert isinstance(build_language_model(Settings(**BASE)), OpenAIResponsesModel)
    monkeypatch.delenv("OPENAI_API_KEY")
    s = Settings(**BASE)
    assert s.llm_provider is None
    assert not build_language_model(s).configured
    assert check_connection(s)["status"] == "no_configurado"


def test_gemini_preserves_quota_category_and_redacts_sdk_error():
    from types import SimpleNamespace
    class ProviderError(Exception):
        code=429
    attempts=[]
    def fail(**kw):
        attempts.append(kw["model"])
        raise ProviderError("clave-secreta texto privado https://example.test/?key=privado")
    model=GeminiModel(Settings(_env_file=None,gemini_api_key=None,gemini_model="principal",gemini_fallback_model="respaldo"))
    model._client=SimpleNamespace(models=SimpleNamespace(generate_content=fail))
    r=model.answer(LlmRequest(system="Prueba",context_json="{}",question="Texto"))
    assert attempts==["principal","respaldo"] and r.error_code=="quota" and r.model=="respaldo"
    assert "secreta" not in r.error and "privado" not in r.error and "https://" not in r.error
