"""Punto de composición: conecta configuración, adaptadores y casos de uso."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import sessionmaker

from ceres.application.ports import LanguageModel
from ceres.config import Settings, get_settings
from ceres.domain.catalog import Catalog
from ceres.domain.climate import ClimateSeries, monthly_climatology
from ceres.domain.engine import ClimateInput
from ceres.infrastructure.catalog_loader import load_catalog, load_sources_file
from ceres.infrastructure.db.session import session_factory
from ceres.infrastructure.llm.factory import build_language_model
from ceres.infrastructure.nasa_power import NasaPowerError, PowerSnapshot, load_snapshot
from ceres.infrastructure.regions import RegionsService
from ceres.infrastructure.security import RateLimiter

log = logging.getLogger("ceres")


@dataclass
class Container:
    settings: Settings
    sessions: sessionmaker
    catalog: Catalog
    sources_file: dict
    climate: ClimateInput
    snapshot: PowerSnapshot | None
    climatology: list[dict]
    regions: RegionsService
    llm: LanguageModel
    login_limiter: RateLimiter
    chat_limiter: RateLimiter
    nasa_error: str | None = None
    extra: dict = field(default_factory=dict)


def build_container(settings: Settings | None = None, llm: LanguageModel | None = None) -> Container:
    settings = settings or get_settings()
    catalog = load_catalog(settings.data_dir / "catalog" / "catalog.json")
    sources_file = load_sources_file(settings.data_dir / "sources" / "sources.json")
    snapshot, nasa_error = None, None
    try:
        snapshot = load_snapshot(settings.data_dir / settings.nasa_snapshot_file)
        series = ClimateSeries.from_days(snapshot.days, snapshot.query_latitude, snapshot.cell_elevation_m or 0.0)
        climate = ClimateInput(snapshot.snapshot_id, series)
        climatology = monthly_climatology(series)
    except NasaPowerError as exc:
        log.warning("NASA POWER no disponible: %s", exc)
        nasa_error = str(exc)
        climate = ClimateInput(None, None)
        climatology = []
    return Container(
        settings=settings,
        sessions=session_factory(settings.database_url),
        catalog=catalog,
        sources_file=sources_file,
        climate=climate,
        snapshot=snapshot,
        climatology=climatology,
        regions=RegionsService(settings),
        llm=llm or build_language_model(settings),
        login_limiter=RateLimiter(settings.login_max_attempts, settings.login_window_seconds),
        chat_limiter=RateLimiter(20, 300),
        nasa_error=nasa_error,
    )
