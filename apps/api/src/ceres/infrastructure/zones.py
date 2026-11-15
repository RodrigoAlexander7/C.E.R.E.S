"""Registro de zonas piloto (`data/zonas/`): cada zona trae sus límites, supuestos con fuente,
catálogo revisado y su propia instantánea NASA POWER. Nada se comparte entre zonas.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from ceres.domain.catalog import Catalog
from ceres.domain.climate import ClimateSeries, monthly_climatology
from ceres.domain.engine import ClimateInput
from ceres.domain.model import ZoneContext
from ceres.infrastructure.catalog_loader import load_catalog
from ceres.infrastructure.nasa_power import NasaPowerError, PowerSnapshot, load_snapshot

log = logging.getLogger("ceres")


@dataclass
class ZoneRuntime:
    id: str
    data: dict
    catalog: Catalog
    climate: ClimateInput
    snapshot: PowerSnapshot | None
    climatology: list[dict]
    nasa_error: str | None
    nasa_file: str  # ruta relativa a data/
    extra: dict = field(default_factory=dict)

    @property
    def name(self) -> str:
        return self.data["name"]

    @property
    def version(self) -> str:
        return self.data["version"]

    @property
    def districts(self) -> list[str]:
        return list(self.data.get("districts", []))

    def context(self) -> ZoneContext:
        d = self.data
        w = d.get("water_m3_ha_year") or {}
        method = (d.get("default_method") or {}).get("value")
        eff = (d.get("efficiency_by_method") or {}).get(method) if method else None
        return ZoneContext(
            id=self.id,
            name=d["name"],
            nasa_source_id=self.climate.source_id,
            zone_source_id=d["zone_source_id"],
            water_label=w.get("label") if w.get("value") is not None else None,
            water_source_ids=tuple(s for s in [w.get("source_id")] if s),
            local_water_source_ids=tuple(d.get("local_water_source_ids", [])),
            default_method=method,
            default_efficiency=eff,
        )

    def public(self) -> dict:
        """Resumen público de la zona para las tres superficies."""
        d = self.data
        cat = self.catalog
        crops = [{"id": c.id, "name": c.short_name.capitalize(), "full_name": c.name, "hint": c.hint, "in_catalog": True} for c in cat.crops.values()]
        crops += [
            {"id": k, "name": v, "full_name": v, "hint": cat.non_catalog_hints.get(k, ""), "in_catalog": False}
            for k, v in cat.non_catalog_crops.items()
            if k != "otro"
        ]
        return {
            "id": self.id,
            "name": d["name"],
            "zone": d["zone"],
            "region": d.get("region"),
            "version": d["version"],
            "districts": self.districts,
            "recognition": d.get("recognition"),
            "center": d.get("center"),
            "elevation_m": d.get("elevation_m"),
            "catalog_version": cat.version,
            "nasa_snapshot_id": self.snapshot.snapshot_id if self.snapshot else None,
            "nasa_source_id": self.climate.source_id,
            "crops": crops,
            "water_m3_ha_year": d.get("water_m3_ha_year"),
            "default_method": d.get("default_method"),
            "efficiency_by_method": d.get("efficiency_by_method"),
            "default_area_ha": d.get("default_area_ha"),
            "note": d.get("note"),
            "zone_source_id": d.get("zone_source_id"),
        }


@dataclass
class ZoneRegistry:
    zones: dict[str, ZoneRuntime]
    default_id: str
    version: str

    def get(self, zone_id: str | None) -> ZoneRuntime | None:
        return self.zones.get(zone_id or self.default_id)

    @property
    def default(self) -> ZoneRuntime:
        return self.zones[self.default_id]

    def zone_of_district(self, code: str | None) -> ZoneRuntime | None:
        if not code:
            return None
        return next((z for z in self.zones.values() if code in z.districts), None)

    def pilot_districts(self) -> dict[str, str]:
        return {code: z.id for z in self.zones.values() for code in z.districts}


def _load_zone(data_dir: Path, zone_id: str) -> ZoneRuntime:
    base = data_dir / "zonas" / zone_id
    data = json.loads((base / "zona.json").read_text())
    if data.get("id") != zone_id:
        raise ValueError(f"zona.json de {zone_id} declara otro id: {data.get('id')}")
    catalog = load_catalog(base / data["catalog_file"])
    nasa_rel = f"zonas/{zone_id}/{data['nasa']['file']}"
    source_id = data["nasa"]["source_id"]
    snapshot, nasa_error = None, None
    try:
        snapshot = load_snapshot(data_dir / nasa_rel)
        series = ClimateSeries.from_days(snapshot.days, snapshot.query_latitude, snapshot.cell_elevation_m or 0.0)
        climate = ClimateInput(snapshot.snapshot_id, series, source_id=source_id)
        climatology = monthly_climatology(series)
    except NasaPowerError as exc:
        log.warning("NASA POWER no disponible para %s: %s", zone_id, exc)
        nasa_error = str(exc)
        climate = ClimateInput(None, None, source_id=source_id)
        climatology = []
    return ZoneRuntime(zone_id, data, catalog, climate, snapshot, climatology, nasa_error, nasa_rel)


def load_zones(data_dir: Path) -> ZoneRegistry:
    reg = json.loads((data_dir / "zonas" / "registro.json").read_text())
    zones = {zid: _load_zone(data_dir, zid) for zid in reg["zones"]}
    if reg["default"] not in zones:
        raise ValueError("La zona por defecto no está registrada")
    # Ningún distrito puede pertenecer a dos zonas.
    seen: dict[str, str] = {}
    for z in zones.values():
        for code in z.districts:
            if code in seen:
                raise ValueError(f"El distrito {code} está en {seen[code]} y {z.id}")
            seen[code] = z.id
    return ZoneRegistry(zones, reg["default"], reg["version"])
