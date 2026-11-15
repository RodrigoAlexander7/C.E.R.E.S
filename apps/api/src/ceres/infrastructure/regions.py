"""Límites administrativos referenciales (SERFOR, capas INEI) con caché local y procedencia.

IDs públicos: `dep:04`, `prov:0405`, `dist:040520`. Los códigos se conservan como texto.
Son límites referenciales, no catastro. La zona piloto se reconoce por el distrito de Majes (Caylloma).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
from shapely.geometry import mapping, shape

from ceres.config import Settings

SERFOR_BASE = "https://geo.serfor.gob.pe/geoservicios/rest/services/Visor/Limites_Politicos_Administrativos/MapServer"
LAYERS = {"dep": 0, "prov": 1, "dist": 2}
FIELDS = {
    "dep": "IDDPTO,NOMBDEP,FUENTE,FECREG",
    "prov": "IDDPTO,NOMBDEP,IDPROV,NOMBPROV,FUENTE,FECREG",
    "dist": "IDDPTO,NOMBDEP,IDPROV,NOMBPROV,IDDIST,NOMBDIST,FUENTE,FECREG",
}
TOLERANCE = {"dep": 0.01, "prov": 0.004, "dist": 0.0015}
PILOT_DISTRICT = "040520"  # Majes, Caylloma, Arequipa (Irrigación Majes I)
PILOT_NOTE = (
    "Zona piloto: Irrigación Majes I (Pampa de Majes), distrito de Majes, Caylloma. El límite de la irrigación no está "
    "cargado; se usa el distrito como referencia. No confundir con el valle de Majes (Castilla) ni con Majes Siguas II."
)


class RegionsUnavailable(RuntimeError):
    pass


def _dir(settings: Settings) -> Path:
    return settings.data_dir / "regions"


def _round(coords, nd=4):
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [_round(c, nd) for c in coords]


def _fetch(level: str, where: str, timeout: float) -> tuple[list[dict], str]:
    url = f"{SERFOR_BASE}/{LAYERS[level]}/query"
    params = {"where": where, "outFields": FIELDS[level], "returnGeometry": "true", "outSR": "4326", "f": "geojson"}
    try:
        r = httpx.get(url, params=params, timeout=timeout)
        r.raise_for_status()
        data = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise RegionsUnavailable(f"SERFOR no disponible: {exc!r}") from exc
    if data.get("exceededTransferLimit"):
        raise RegionsUnavailable("La consulta excedió el límite de registros del servicio")
    feats = []
    for f in data.get("features", []):
        g = shape(f["geometry"]).simplify(TOLERANCE[level], preserve_topology=True)
        feats.append({"type": "Feature", "properties": f["properties"], "geometry": {**mapping(g), "coordinates": _round(mapping(g)["coordinates"])}})
    return feats, str(r.url)


def _save(path: Path, feats: list[dict], request_url: str) -> dict:
    fecreg = max((f["properties"].get("FECREG") or 0) for f in feats) if feats else None
    meta = {
        "provider": "SERFOR (servicio ArcGIS), capas INEI",
        "request_url": request_url,
        "fetched_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "features": len(feats),
        "source_update": datetime.fromtimestamp(fecreg / 1000, UTC).date().isoformat() if fecreg else None,
        "transformation": "Geometría simplificada localmente con Shapely (preserve_topology) y coordenadas a 4 decimales.",
        "note": "Límites referenciales, no catastro de propiedad.",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"type": "FeatureCollection", "features": feats, "ceres_meta": meta}, ensure_ascii=False, separators=(",", ":")))
    return meta


def download_demo_package(settings: Settings) -> dict:
    d = _dir(settings)
    report = {}
    feats, url = _fetch("dep", "1=1", 120)
    report["departamentos"] = _save(d / "departamentos.geojson", feats, url)
    feats, url = _fetch("prov", "1=1", 180)
    report["provincias"] = _save(d / "provincias.geojson", feats, url)
    feats, url = _fetch("dist", "IDDPTO='04'", 180)
    report["distritos_04"] = _save(d / "distritos" / "04.geojson", feats, url)
    return report


class RegionsService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._cache: dict[str, dict] = {}

    def _load(self, rel: str) -> dict | None:
        if rel in self._cache:
            return self._cache[rel]
        p = _dir(self.settings) / rel
        if not p.exists():
            return None
        data = json.loads(p.read_text())
        self._cache[rel] = data
        return data

    @staticmethod
    def _node(level: str, props: dict, geometry: dict | None, meta: dict) -> dict:
        if level == "dep":
            code, name, parent = props["IDDPTO"], props["NOMBDEP"], None
        elif level == "prov":
            code, name, parent = props["IDPROV"], props["NOMBPROV"], f"dep:{props['IDDPTO']}"
        else:
            code, name, parent = props["IDDIST"], props["NOMBDIST"], f"prov:{props['IDPROV']}"
        return {
            "id": f"{level}:{code}",
            "level": {"dep": "departamento", "prov": "provincia", "dist": "distrito"}[level],
            "code": code,
            "name": name.title(),
            "parent_id": parent,
            "pilot": level == "dist" and code == PILOT_DISTRICT or (level == "prov" and code == PILOT_DISTRICT[:4]) or (level == "dep" and code == PILOT_DISTRICT[:2]),
            "geometry": geometry,
            "provenance": {"provider": meta.get("provider"), "source_update": meta.get("source_update"), "fetched_at": meta.get("fetched_at"), "note": meta.get("note")},
        }

    def departments(self) -> list[dict]:
        data = self._load("departamentos.geojson")
        if data is None:
            raise RegionsUnavailable("Paquete de límites no descargado (ejecuta `ceres.cli fetch-regions`)")
        return sorted((self._node("dep", f["properties"], f["geometry"], data["ceres_meta"]) for f in data["features"]), key=lambda n: n["name"])

    def children(self, region_id: str) -> list[dict]:
        level, _, code = region_id.partition(":")
        if not code.isdigit():
            raise KeyError(region_id)
        if level == "dep":
            data = self._load("provincias.geojson")
            if data is None:
                raise RegionsUnavailable("Paquete de provincias no descargado")
            feats = [f for f in data["features"] if f["properties"]["IDDPTO"] == code]
            return sorted((self._node("prov", f["properties"], f["geometry"], data["ceres_meta"]) for f in feats), key=lambda n: n["name"])
        if level == "prov":
            dep = code[:2]
            rel = f"distritos/{dep}.geojson"
            data = self._load(rel)
            if data is None:
                if not self.settings.regions_live_fetch:
                    raise RegionsUnavailable("Distritos de este departamento no descargados")
                feats, url = _fetch("dist", f"IDDPTO='{dep}'", self.settings.regions_timeout_seconds)
                _save(_dir(self.settings) / rel, feats, url)
                data = self._load(rel)
            feats = [f for f in data["features"] if f["properties"]["IDPROV"] == code]
            return sorted((self._node("dist", f["properties"], f["geometry"], data["ceres_meta"]) for f in feats), key=lambda n: n["name"])
        if level == "dist":
            return []
        raise KeyError(region_id)

    def pilot_district(self) -> dict | None:
        try:
            for n in self.children(f"prov:{PILOT_DISTRICT[:4]}"):
                if n["code"] == PILOT_DISTRICT:
                    return n
        except RegionsUnavailable:
            return None
        return None

    def locate_point(self, lat: float, lon: float) -> dict | None:
        """Devuelve el distrito precargado que contiene el punto (solo con datos locales)."""
        from shapely.geometry import Point

        pt = Point(lon, lat)
        for rel in sorted((_dir(self.settings) / "distritos").glob("*.geojson")):
            data = self._load(f"distritos/{rel.name}")
            for f in data["features"]:
                if shape(f["geometry"]).contains(pt):
                    return self._node("dist", f["properties"], None, data["ceres_meta"])
        return None
