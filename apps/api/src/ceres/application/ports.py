"""Puertos de la capa de aplicación (implementados por adaptadores de infraestructura)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

ProviderStatus = Literal["ok", "no_configurado", "error_proveedor", "respuesta_no_validada"]


def provider_schema(schema: dict) -> dict:
    """Subconjunto JSON Schema interoperable; Pydantic conserva la validación completa."""
    definitions = schema.get("$defs", {})
    def visit(value):
        if isinstance(value, list): return [visit(x) for x in value]
        if not isinstance(value, dict): return value
        if "$ref" in value:
            return visit(definitions[value["$ref"].split("/")[-1]])
        result = {}
        for key, v in value.items():
            if key in {"$defs", "title", "default", "discriminator", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems", "minLength", "maxLength"}: continue
            if key == "const": result["enum"] = [v]
            elif key == "properties": result[key] = {name: visit(prop) for name, prop in v.items()}
            else: result["anyOf" if key == "oneOf" else key] = visit(v)
        if "properties" in result:
            result["required"] = list(result["properties"])
        return result
    return visit(schema)


@dataclass
class LlmRequest:
    system: str
    context_json: str
    question: str
    history: list[dict] = field(default_factory=list)
    feedback: str | None = None
    schema: dict | None = None
    audio: bytes | None = None
    audio_mime: str | None = None


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
