"""Catálogo agronómico curado (fichas de cultivo, asociación y plantillas de estrategia).

Cada parámetro conserva su estado de revisión y fuentes. El catálogo es pequeño y versionado.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

PARAM_STATUSES = {
    "referencia_bibliografica",  # tomado de una fuente publicada, sin calibración local
    "supuesto_demo",  # valor de demostración, debe reemplazarse con datos locales
    "sin_verificar",  # referencia indexada que no pudo abrirse para comprobarla
    "revisado_local",  # revisado por agrónomo local (ninguno todavía)
}


@dataclass(frozen=True)
class Window:
    """Ventana de siembra por mes-día; puede cruzar el fin de año."""

    start_md: tuple[int, int]
    end_md: tuple[int, int]

    def contains(self, d: date) -> bool:
        md = (d.month, d.day)
        if self.start_md <= self.end_md:
            return self.start_md <= md <= self.end_md
        return md >= self.start_md or md <= self.end_md

    def label(self) -> str:
        meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
        return f"{self.start_md[1]} {meses[self.start_md[0]-1]} – {self.end_md[1]} {meses[self.end_md[0]-1]}"


@dataclass(frozen=True)
class ThermalRule:
    id: str
    label: str
    stages: tuple[str, ...]  # nombres de etapa o ("todas",)
    variable: str  # t_min | t_max | t_mean
    comparator: str
    threshold_c: float
    status: str
    source_ids: tuple[str, ...]
    note: str


@dataclass(frozen=True)
class Economics:
    yield_t_ha: float | None
    price_soles_kg: float | None
    variable_cost_soles_ha: float | None
    status: str
    price_label: str
    note: str
    source_ids: tuple[str, ...] = ()
    # Precio mayorista observado (MIDAGRI-SISAP) del que sale el precio en chacra: mediana, rango,
    # fechas y factor chacra/mayorista (supuesto). None si el cultivo no tiene precio SISAP.
    market: dict | None = None
    # Volatilidad del precio (σ de un log-normal) para el análisis de riesgo; supuesto de demostración.
    price_sigma: float | None = None


@dataclass(frozen=True)
class CropProfile:
    id: str
    name: str
    family: str
    is_legume: bool
    destination: str
    stage_days: tuple[int, int, int, int]  # inicial, desarrollo, media, final
    kc_ini: float
    kc_mid: float
    kc_end: float
    stage_status: str
    stage_source_ids: tuple[str, ...]
    kc_source_ids: tuple[str, ...]
    windows: tuple[Window, ...]
    window_status: str
    window_source_ids: tuple[str, ...]
    salinity_ece_threshold: float | None
    salinity_ece_50: float | None
    salinity_source_ids: tuple[str, ...]
    thermal_rules: tuple[ThermalRule, ...]
    economics: Economics
    residue_note: str
    nutrition_note: str
    kc_note: str = ""
    short: str = ""  # nombre cotidiano («maíz»)
    hint: str = ""

    @property
    def short_name(self) -> str:
        return self.short or self.name.split(" (")[0].lower()

    @property
    def cycle_days(self) -> int:
        return sum(self.stage_days)

    def stage_name(self, i: int) -> str:
        return ("inicial", "desarrollo", "media", "final")[i]

    def kc_on_day(self, k: int) -> float:
        """Kc del día k (0 = siembra) con la curva FAO-56 de 4 tramos (lineal en desarrollo y final)."""
        a, b, c, d = self.stage_days
        if k < a:
            return self.kc_ini
        if k < a + b:
            return self.kc_ini + (self.kc_mid - self.kc_ini) * (k - a + 1) / b
        if k < a + b + c:
            return self.kc_mid
        return self.kc_mid + (self.kc_end - self.kc_mid) * (k - a - b - c + 1) / d

    def stage_ranges(self, plant: date) -> list[tuple[str, date, date]]:
        out, cur = [], plant
        for i, n in enumerate(self.stage_days):
            out.append((self.stage_name(i), cur, cur + timedelta(days=n - 1)))
            cur += timedelta(days=n)
        return out

    @property
    def salinity_sensitive(self) -> bool:
        return self.salinity_ece_threshold is not None and self.salinity_ece_threshold < 1.5


@dataclass(frozen=True)
class AssociationProfile:
    id: str
    name: str
    components: tuple[str, ...]
    structure: str
    status: str  # exploratoria
    known: tuple[str, ...]
    missing: tuple[str, ...]
    source_ids: tuple[str, ...]
    warning: str


@dataclass(frozen=True)
class StrategyTemplate:
    id: str
    name: str
    short: str
    sequence_rule: str  # "declarada" | "alternar"
    cap_status: str | None  # p. ej. "exploratoria"
    rationale: str
    source_ids: tuple[str, ...]
    crops: tuple[str, ...] = ()  # para "alternar": cultivos que se turnan


@dataclass(frozen=True)
class Catalog:
    version: str
    crops: dict[str, CropProfile]
    associations: tuple[AssociationProfile, ...]
    templates: tuple[StrategyTemplate, ...]
    prep_days: int
    prep_status: str
    transition_cost_soles_ha: float | None
    transition_cost_status: str
    horizon_months: int
    scenario_low: tuple[float, float]  # (factor rendimiento, factor precio)
    scenario_high: tuple[float, float]
    non_catalog_crops: dict[str, str] = field(default_factory=dict)
    non_catalog_hints: dict[str, str] = field(default_factory=dict)

    def crop(self, crop_id: str) -> CropProfile | None:
        return self.crops.get(crop_id)

    def knows(self, crop_id: str) -> bool:
        """Cultivo reconocido en esta zona (con ficha o como cultivo declarable sin ficha)."""
        return crop_id in self.crops or crop_id in self.non_catalog_crops

    def crop_label(self, crop_id: str) -> str:
        c = self.crops.get(crop_id)
        return c.name if c else self.non_catalog_crops.get(crop_id, crop_id)
