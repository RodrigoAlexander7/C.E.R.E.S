"""Adaptador NASA POWER (API diaria puntual, comunidad AG).

Descarga una sola vez y guarda la respuesta bruta junto a sus metadatos y hash.
La aplicación lee la copia guardada; nunca descarga años de datos por petición.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

import httpx

from ceres.domain.climate import DailyWeather

POWER_DAILY_POINT_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_PARAMETERS = (
    "T2M",
    "T2M_MIN",
    "T2M_MAX",
    "PRECTOTCORR",
    "RH2M",
    "WS2M",
    "ALLSKY_SFC_SW_DWN",
    "PS",
)
# Unidades que el motor espera; si la respuesta trae otras, la carga falla en vez de convertir a ciegas.
EXPECTED_UNITS = {
    "T2M": "C",
    "T2M_MIN": "C",
    "T2M_MAX": "C",
    "PRECTOTCORR": "mm/day",
    "RH2M": "%",
    "WS2M": "m/s",
    "ALLSKY_SFC_SW_DWN": "MJ/m^2/day",
    "PS": "kPa",
}


class NasaPowerError(RuntimeError):
    pass


@dataclass(frozen=True)
class PowerSnapshot:
    """Instantánea real de NASA POWER cargada desde disco."""

    snapshot_id: str
    sha256: str
    request_url: str
    query_latitude: float
    query_longitude: float
    cell_elevation_m: float | None
    start: date
    end: date
    time_standard: str
    community: str
    parameters: dict[str, dict[str, str]]
    fetched_at: str
    days: list[DailyWeather]
    missing_by_parameter: dict[str, int]
    source_note: str

    def public_summary(self) -> dict:
        return {
            "snapshot_id": self.snapshot_id,
            "provider": "NASA POWER (Prediction Of Worldwide Energy Resources)",
            "product": "Daily API, punto, comunidad AG",
            "request_url": self.request_url,
            "query_latitude": self.query_latitude,
            "query_longitude": self.query_longitude,
            "cell_elevation_m": self.cell_elevation_m,
            "period": {"start": self.start.isoformat(), "end": self.end.isoformat()},
            "time_standard": self.time_standard,
            "parameters": self.parameters,
            "fetched_at": self.fetched_at,
            "sha256": self.sha256,
            "days": len(self.days),
            "missing_by_parameter": self.missing_by_parameter,
            "spatial_scale": "Meteorología regional ≈ 0,5° × 0,625° (MERRA-2); radiación ≈ 1° (CERES/GEWEX). No es medición parcelaria.",
            "kind": "observado",
            "note": self.source_note,
        }


def build_request_params(lat: float, lon: float, start: date, end: date) -> dict[str, str]:
    return {
        "parameters": ",".join(POWER_PARAMETERS),
        "community": "AG",
        "longitude": f"{lon:.4f}",
        "latitude": f"{lat:.4f}",
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
        "time-standard": "LST",
    }


def fetch_and_store(
    lat: float, lon: float, start: date, end: date, out_path: Path, timeout: float = 120.0
) -> Path:
    """Descarga la serie real y la guarda con un archivo `.meta.json` de procedencia."""

    params = build_request_params(lat, lon, start, end)
    try:
        response = httpx.get(POWER_DAILY_POINT_URL, params=params, timeout=timeout)
    except httpx.HTTPError as exc:  # red, DNS, timeout
        raise NasaPowerError(f"No se pudo contactar NASA POWER: {exc!r}") from exc
    if response.status_code != 200:
        raise NasaPowerError(
            f"NASA POWER respondió {response.status_code}: {response.text[:300]}"
        )
    raw = response.content
    payload = json.loads(raw)
    _validate_payload(payload)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(raw)
    meta = {
        "provider": "NASA POWER",
        "request_url": str(response.url),
        "request_params": params,
        "fetched_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "note": "Respuesta bruta sin modificar. Serie histórica regional; no es pronóstico ni medición parcelaria.",
    }
    meta_path(out_path).write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    return out_path


def meta_path(path: Path) -> Path:
    return path.with_suffix(".meta.json")


def _validate_payload(payload: dict) -> None:
    try:
        units = {k: v["units"] for k, v in payload["parameters"].items()}
        series = payload["properties"]["parameter"]
    except (KeyError, TypeError) as exc:
        raise NasaPowerError("Respuesta NASA POWER sin la estructura esperada") from exc
    for name, expected in EXPECTED_UNITS.items():
        if name not in series:
            raise NasaPowerError(f"Falta el parámetro {name} en la respuesta")
        if units.get(name) != expected:
            raise NasaPowerError(
                f"Unidad inesperada para {name}: {units.get(name)!r} (se esperaba {expected!r})"
            )


def load_snapshot(path: Path) -> PowerSnapshot:
    """Lee la copia real guardada, valida unidades y marca ausentes (nunca los convierte en cero)."""

    if not path.exists():
        raise NasaPowerError(f"No existe la instantánea NASA en {path}")
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    meta_file = meta_path(path)
    meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
    if meta.get("sha256") and meta["sha256"] != sha:
        raise NasaPowerError("El hash del archivo NASA no coincide con sus metadatos")
    payload = json.loads(raw)
    _validate_payload(payload)

    header = payload.get("header", {})
    fill_value = header.get("fill_value", -999.0)
    series = payload["properties"]["parameter"]
    coords = payload.get("geometry", {}).get("coordinates", [None, None, None])
    dates = sorted(series["T2M"].keys())
    missing = {p: 0 for p in EXPECTED_UNITS}

    def value(param: str, key: str) -> float | None:
        v = series[param].get(key)
        if v is None or v == fill_value or v <= -998:
            missing[param] += 1
            return None
        return float(v)

    days: list[DailyWeather] = []
    for key in dates:
        days.append(
            DailyWeather(
                day=datetime.strptime(key, "%Y%m%d").date(),
                t_mean=value("T2M", key),
                t_min=value("T2M_MIN", key),
                t_max=value("T2M_MAX", key),
                precipitation_mm=value("PRECTOTCORR", key),
                rh_mean=value("RH2M", key),
                wind_2m=value("WS2M", key),
                solar_mj=value("ALLSKY_SFC_SW_DWN", key),
                pressure_kpa=value("PS", key),
            )
        )

    request_params = meta.get("request_params", {})
    return PowerSnapshot(
        snapshot_id=f"nasa-power-{sha[:12]}",
        sha256=sha,
        request_url=meta.get("request_url", POWER_DAILY_POINT_URL),
        query_latitude=float(request_params.get("latitude", coords[1] or 0)),
        query_longitude=float(request_params.get("longitude", coords[0] or 0)),
        cell_elevation_m=float(coords[2]) if len(coords) > 2 and coords[2] is not None else None,
        start=days[0].day,
        end=days[-1].day,
        time_standard=request_params.get("time-standard", header.get("time_standard", "?")),
        community="AG",
        parameters={
            k: {"units": v.get("units", ""), "longname": v.get("longname", "")}
            for k, v in payload["parameters"].items()
        },
        fetched_at=meta.get("fetched_at", "desconocida"),
        days=days,
        missing_by_parameter=missing,
        source_note=meta.get("note", ""),
    )
