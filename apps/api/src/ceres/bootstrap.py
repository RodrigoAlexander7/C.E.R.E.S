"""Punto de composición: conecta configuración, adaptadores y casos de uso."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import sessionmaker

from ceres.application.ports import LanguageModel
from ceres.config import Settings, get_settings
from ceres.domain.catalog import Catalog
from ceres.domain.engine import ClimateInput
from ceres.infrastructure.catalog_loader import load_sources_file
from ceres.infrastructure.db.session import session_factory
from ceres.infrastructure.llm.factory import build_language_model
from ceres.domain.enso import monthly_phases
from ceres.infrastructure.nasa_power import PowerSnapshot
from ceres.infrastructure.noaa_oni import OniError, OniSnapshot, load_oni
from ceres.infrastructure.regions import RegionsService
from ceres.infrastructure.security import RateLimiter
from ceres.infrastructure.zones import ZoneRegistry, ZoneRuntime, load_zones

log = logging.getLogger("ceres")


@dataclass
class Container:
    settings: Settings
    sessions: sessionmaker
    zones: ZoneRegistry
    sources_file: dict
    regions: RegionsService
    llm: LanguageModel
    login_limiter: RateLimiter
    chat_limiter: RateLimiter
    quick_limiter: RateLimiter | None = None
    oni: OniSnapshot | None = None
    enso_phases: dict | None = None
    extra: dict = field(default_factory=dict)

    def zone(self, zone_id: str | None = None) -> ZoneRuntime | None:
        return self.zones.get(zone_id)

    # Atajos a la zona por defecto (Majes I), para código y pruebas anteriores al registro de zonas.
    @property
    def catalog(self) -> Catalog:
        return self.zones.default.catalog

    @property
    def climate(self) -> ClimateInput:
        return self.zones.default.climate

    @property
    def snapshot(self) -> PowerSnapshot | None:
        return self.zones.default.snapshot


def build_container(settings: Settings | None = None, llm: LanguageModel | None = None) -> Container:
    settings = settings or get_settings()
    zones = load_zones(settings.data_dir)
    oni = None
    try:
        oni = load_oni(settings.data_dir / "noaa" / "oni.ascii.txt")
    except OniError as exc:
        log.warning("ONI de NOAA no disponible: %s", exc)
    return Container(
        oni=oni,
        enso_phases=monthly_phases(oni.anomalies) if oni else None,
        settings=settings,
        sessions=session_factory(settings.database_url),
        zones=zones,
        sources_file=load_sources_file(settings.data_dir / "sources" / "sources.json"),
        regions=RegionsService(settings, zones.pilot_districts()),
        llm=llm or build_language_model(settings),
        login_limiter=RateLimiter(settings.login_max_attempts, settings.login_window_seconds),
        chat_limiter=RateLimiter(20, 300),
        quick_limiter=RateLimiter(60, 600),
    )
