"""Precios mayoristas MIDAGRI-SISAP (`data/precios/*.csv`).

Fuente: http://sistemas.midagri.gob.pe/sisap/portal2/ciudades/ — precio PROMEDIO MAYORISTA por mercado,
producto y día, ya convertido a S/ por kg (columna `Precio_Unitario_Kg_Lt_Soles`). Es un precio de
mercado mayorista, NO el precio en chacra, y es de hoy, no el de la cosecha futura.
"""

from __future__ import annotations

import csv
import statistics
from dataclasses import dataclass
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

SOURCE_ID = "MIDAGRI-SISAP"


@dataclass(frozen=True)
class MarketStat:
    market: str
    product: str
    median: float
    low: float
    high: float
    days: int
    first: date
    last: date
    slope_week: float | None  # S/ por kg por semana (regresión lineal sobre la mediana diaria)
    series: tuple[tuple[date, float], ...]

    def public(self) -> dict:
        return {
            "market": self.market,
            "product": self.product,
            "median_soles_kg": round(self.median, 2),
            "low_soles_kg": round(self.low, 2),
            "high_soles_kg": round(self.high, 2),
            "days": self.days,
            "first": self.first.isoformat(),
            "last": self.last.isoformat(),
            "trend_soles_kg_week": round(self.slope_week, 3) if self.slope_week is not None else None,
            "series": [{"date": d.isoformat(), "soles_kg": round(v, 2)} for d, v in self.series],
            "source_id": SOURCE_ID,
        }


def _slope(points: list[tuple[date, float]]) -> float | None:
    if len(points) < 3:
        return None
    xs = [p[0].toordinal() for p in points]
    ys = [p[1] for p in points]
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den * 7


def parse_rows(rows: list[dict]) -> dict[tuple[str, str], MarketStat]:
    daily: dict[tuple[str, str], dict[date, list[float]]] = {}
    for r in rows:
        try:
            price = float(r["Precio_Unitario_Kg_Lt_Soles"])
            day = datetime.strptime(r["Fecha"].strip(), "%d/%m/%Y").date()
        except (KeyError, ValueError):
            continue
        if price <= 0:
            continue
        key = (r["Mercado_Region"].strip(), r["Producto"].strip())
        daily.setdefault(key, {}).setdefault(day, []).append(price)
    out: dict[tuple[str, str], MarketStat] = {}
    for key, by_day in daily.items():
        pts = sorted((d, statistics.median(v)) for d, v in by_day.items())
        vals = [v for _, v in pts]
        out[key] = MarketStat(
            market=key[0], product=key[1], median=statistics.median(vals), low=min(vals), high=max(vals),
            days=len(pts), first=pts[0][0], last=pts[-1][0], slope_week=_slope(pts), series=tuple(pts),
        )
    return out


@lru_cache
def load_prices(folder: Path) -> dict[tuple[str, str], MarketStat]:
    """Todas las tablas SISAP de la carpeta (CSV con BOM, `;` y CRLF). Carpeta ausente → sin precios."""
    rows: list[dict] = []
    if folder.is_dir():
        for f in sorted(folder.glob("*.csv")):
            with f.open(encoding="utf-8-sig", newline="") as fh:
                rows += list(csv.DictReader(fh, delimiter=";"))
    return parse_rows(rows)
