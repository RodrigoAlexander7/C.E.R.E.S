"""Puertos de la capa de aplicación (implementados por adaptadores de infraestructura)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

ProviderStatus = Literal["ok", "no_configurado", "error_proveedor", "respuesta_no_validada"]


@dataclass
class LlmRequest:
    system: str
    context_json: str
    question: str
    history: list[dict] = field(default_factory=list)
    feedback: str | None = None


@dataclass
class LlmResult:
    status: ProviderStatus
    data: dict | None = None  # salida estructurada
    model: str | None = None
    error: str | None = None


class LanguageModel(Protocol):
    @property
    def configured(self) -> bool: ...

    @property
    def model_name(self) -> str | None: ...

    def answer(self, request: LlmRequest) -> LlmResult: ...


ANSWER_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "answer": {"type": "string", "description": "Respuesta breve en español sencillo (máx. 4 frases)."},
        "detail": {"type": "string", "description": "Detalle opcional para desplegar; puede estar vacío."},
        "metric_ids": {"type": "array", "items": {"type": "string"}, "description": "IDs de métricas del contexto usadas."},
        "source_ids": {"type": "array", "items": {"type": "string"}, "description": "IDs de fuentes del contexto usadas."},
        "assumptions": {"type": "array", "items": {"type": "string"}},
        "missing_data": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "detail", "metric_ids", "source_ids", "assumptions", "missing_data"],
}
