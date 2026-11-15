"""Configuración leída del entorno (ver `.env.example` en la raíz del repositorio)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Revisión (SHA) de la imagen desplegada; la fija el Dockerfile.
    ceres_revision: str = "dev"

    # Obligatorio para arrancar.
    database_url: str = "postgresql+psycopg://ceres:ceres_dev@127.0.0.1:5440/ceres"

    # Sesión y origen.
    app_origin: str = "http://localhost:3000"
    session_cookie_name: str = "ceres_session"
    csrf_cookie_name: str = "ceres_csrf"
    session_ttl_hours: int = 72
    # Solo para desarrollo local por HTTP: desactiva el atributo Secure de las cookies.
    dev_insecure_cookies: bool = False

    # Asistente IA (opcional: sin claves la interfaz muestra «IA no conectada»).
    # Proveedor principal: Google Gemini. OpenAI Responses queda como alternativa.
    gemini_api_key: str | None = None
    gemini_model: str | None = Field(default=None, validation_alias=AliasChoices("GEMINI_MODEL", "GEMINI_MODE"))
    # Presupuesto de razonamiento: 0 = respuesta rápida (el motor ya calculó todo); vacío = valor del modelo.
    gemini_thinking_budget: int | None = 0
    openai_api_key: str | None = None
    openai_model: str | None = None
    llm_timeout_seconds: float = Field(default=40.0, validation_alias=AliasChoices("LLM_TIMEOUT_SECONDS", "OPENAI_TIMEOUT_SECONDS"))
    llm_max_question_chars: int = 600

    # Datos y caché.
    data_dir: Path = REPO_ROOT / "data"
    nasa_snapshot_file: str = "nasa/power_daily_majes_2015_2025.json"
    regions_live_fetch: bool = True
    regions_timeout_seconds: float = 20.0

    # Límite simple de intentos de login por email+IP en memoria.
    login_max_attempts: int = 8
    login_window_seconds: int = 600

    @property
    def llm_provider(self) -> str | None:
        if self.gemini_api_key and self.gemini_model:
            return "gemini"
        if self.openai_api_key and self.openai_model:
            return "openai"
        return None

    @property
    def llm_configured(self) -> bool:
        return self.llm_provider is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
