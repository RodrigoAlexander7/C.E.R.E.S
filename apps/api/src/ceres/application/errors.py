"""Errores de operaciones; la presentación los convierte en respuesta HTTP."""

from ceres.application.ports import LlmResult


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status, self.code, self.message = status, code, message


def llm_failure(result: LlmResult) -> ApiError:
    if result.error_code == "quota":
        return ApiError(503, "ia_sin_cuota", "El servicio de IA alcanzó su límite de uso. Puedes usar el formulario e intentarlo más tarde")
    if result.error_code == "timeout":
        return ApiError(503, "ia_timeout", "La IA está tardando en responder. Conserva tu texto; puedes reintentar o usar el formulario")
    if result.error_code == "configuration":
        return ApiError(503, "ia_configuracion", "La conexión de IA necesita revisión. Puedes seguir registrando con el formulario")
    return ApiError(503, "ia_no_disponible", "La IA no pudo procesar el mensaje. Conserva tu texto; vuelve a intentarlo o usa el formulario")
