"""Proveedor simulado para pruebas automatizadas. Nunca se usa en ejecución normal."""

from __future__ import annotations

from collections.abc import Callable

from ceres.application.ports import LlmRequest, LlmResult


class FakeLanguageModel:
    def __init__(self, responder: Callable[[LlmRequest], dict | None]) -> None:
        self._responder = responder
        self.requests: list[LlmRequest] = []

    @property
    def configured(self) -> bool:
        return True

    @property
    def model_name(self) -> str | None:
        return "simulado-pruebas"

    def answer(self, request: LlmRequest) -> LlmResult:
        self.requests.append(request)
        data = self._responder(request)
        if data is None:
            return LlmResult(status="error_proveedor", error="fallo simulado")
        return LlmResult(status="ok", data=data, model="simulado-pruebas")
