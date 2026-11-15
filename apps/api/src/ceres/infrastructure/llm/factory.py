"""Selección del adaptador LLM según la configuración (Gemini primero, luego OpenAI)."""

from __future__ import annotations

from ceres.application.ports import LanguageModel, LlmRequest
from ceres.config import Settings


def build_language_model(settings: Settings) -> LanguageModel:
    if settings.llm_provider == "openai":
        from ceres.infrastructure.llm.openai_responses import OpenAIResponsesModel

        return OpenAIResponsesModel(settings)
    from ceres.infrastructure.llm.gemini import GeminiModel

    return GeminiModel(settings)  # sin claves → no_configurado


def check_connection(settings: Settings) -> dict:
    """Prueba real mínima del proveedor configurado, sin imprimir claves."""
    provider = settings.llm_provider
    if provider is None:
        return {"status": "no_configurado", "detail": "Faltan GEMINI_API_KEY y GEMINI_MODEL (u OPENAI_API_KEY y OPENAI_MODEL) en el servidor"}
    model = build_language_model(settings)
    r = model.answer(
        LlmRequest(
            system="Responde en español, en JSON según el esquema. No inventes datos.",
            context_json='{"prueba": "conexión"}',
            question="Responde exactamente 'conectado' en answer y deja el resto vacío; en missing_data pon 'ninguno'.",
        )
    )
    return {
        "status": "conectado" if r.status == "ok" else r.status,
        "provider": provider,
        "model": r.model or model.model_name,
        "detail": r.error or f"Respuesta estructurada recibida: {r.data}",
    }
