"""Validación de polígonos (Shapely) y área geodésica WGS84 (pyproj)."""

from __future__ import annotations

from pyproj import Geod
from shapely.geometry import Point, shape
from shapely.validation import explain_validity

_GEOD = Geod(ellps="WGS84")
MAX_VERTICES = 2000


class GeometryError(ValueError):
    pass


def validate_polygon(geojson: dict) -> dict:
    if not isinstance(geojson, dict) or geojson.get("type") != "Polygon":
        raise GeometryError("Se espera un polígono GeoJSON")
    coords = geojson.get("coordinates")
    if not coords or not isinstance(coords, list) or not coords[0] or len(coords[0]) < 4:
        raise GeometryError("El polígono necesita al menos tres vértices")
    if sum(len(r) for r in coords) > MAX_VERTICES:
        raise GeometryError("El polígono tiene demasiados vértices")
    for ring in coords:
        for pt in ring:
            if len(pt) < 2 or not (-180 <= pt[0] <= 180 and -90 <= pt[1] <= 90):
                raise GeometryError("Coordenadas fuera de rango (lon, lat en grados)")
    geom = shape(geojson)
    if not geom.is_valid:
        raise GeometryError(f"Polígono inválido: {explain_validity(geom)}")
    return geojson


def geodesic_area_ha(geojson: dict) -> float:
    geom = shape(validate_polygon(geojson))
    area_m2, _ = _GEOD.geometry_area_perimeter(geom)
    area_ha = abs(area_m2) / 10_000
    if area_ha <= 0:
        raise GeometryError("El área calculada no es positiva")
    return area_ha


def centroid(geojson: dict) -> dict:
    c = shape(geojson).centroid
    return {"lat": c.y, "lon": c.x}


def point_in(geojson_multi_or_poly: dict, lat: float, lon: float) -> bool:
    return shape(geojson_multi_or_poly).contains(Point(lon, lat))
