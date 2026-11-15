"""Adaptador NOAA CPC: Índice Oceánico El Niño (ONI, Niño 3.4, ERSSTv5).

Se descarga una vez y se guarda el archivo bruto con su hash; la aplicación lee la copia.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx

ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]


class OniError(RuntimeError):
    pass


@dataclass(frozen=True)
class OniSnapshot:
    snapshot_id: str
    sha256: str
    url: str
    fetched_at: str
    # (año, mes central) → anomalía ONI en °C; DJF 2015 → (2015, 1), NDJ 2015 → (2015, 12)
    anomalies: dict[tuple[int, int], float]

    def public_summary(self) -> dict:
        keys = sorted(self.anomalies)
        return {
            "snapshot_id": self.snapshot_id,
            "provider": "NOAA Climate Prediction Center",
            "product": "Oceanic Niño Index (ONI), anomalía trimestral móvil de TSM en Niño 3.4 (ERSSTv5)",
            "url": self.url,
            "fetched_at": self.fetched_at,
            "sha256": self.sha256,
            "period": {"start": f"{keys[0][0]}-{keys[0][1]:02d}", "end": f"{keys[-1][0]}-{keys[-1][1]:02d}"} if keys else None,
            "kind": "observado",
        }


def parse_oni(text: str) -> dict[tuple[int, int], float]:
    out: dict[tuple[int, int], float] = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) != 4 or parts[0] not in SEASONS:
            continue
        season, year, _total, anom = parts
        out[(int(year), SEASONS.index(season) + 1)] = float(anom)
    if len(out) < 24:
        raise OniError("El archivo ONI no tiene la estructura esperada")
    return out


def fetch_and_store(out_path: Path, timeout: float = 60.0) -> Path:
    try:
        r = httpx.get(ONI_URL, timeout=timeout)
    except httpx.HTTPError as exc:
        raise OniError(f"No se pudo contactar NOAA CPC: {exc!r}") from exc
    if r.status_code != 200:
        raise OniError(f"NOAA CPC respondió {r.status_code}")
    raw = r.content
    parse_oni(raw.decode("utf-8"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(raw)
    meta = {
        "provider": "NOAA Climate Prediction Center",
        "request_url": str(r.url),
        "fetched_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "note": "Archivo bruto sin modificar. Fases El Niño/La Niña según la definición operativa de NOAA: ONI ≥ +0,5 °C (≤ −0,5 °C) durante al menos 5 trimestres móviles consecutivos.",
    }
    out_path.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    return out_path


def load_oni(path: Path) -> OniSnapshot:
    if not path.exists():
        raise OniError(f"No existe la copia ONI en {path}")
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    meta_file = path.with_suffix(".meta.json")
    meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
    if meta.get("sha256") and meta["sha256"] != sha:
        raise OniError("El hash del archivo ONI no coincide con sus metadatos")
    return OniSnapshot(
        snapshot_id=f"noaa-oni-{sha[:12]}",
        sha256=sha,
        url=meta.get("request_url", ONI_URL),
        fetched_at=meta.get("fetched_at", "desconocida"),
        anomalies=parse_oni(raw.decode("utf-8")),
    )
