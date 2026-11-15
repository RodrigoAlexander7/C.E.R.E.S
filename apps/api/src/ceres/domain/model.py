"""Entradas y resultados del motor. Objetos puros, serializables y sin dependencias de frameworks."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any, Literal

Priority = Literal["dinero", "agua", "suelo", "equilibrada"]
Status = Literal["viable_con_supuestos", "no_viable", "requiere_datos", "exploratoria"]
ReasonState = Literal["cumple", "no_cumple", "falta_dato", "advertencia", "informacion"]
Kind = Literal["observado", "declarado", "derivado", "referencia_bibliografica", "supuesto_demo", "supuesto_zona", "sin_verificar"]
IrrigationMethod = Literal["goteo", "aspersion", "gravedad"]

STATUS_LABELS = {
    "viable_con_supuestos": "Viable con supuestos",
    "no_viable": "No viable",
    "requiere_datos": "Requiere datos",
    "exploratoria": "Exploratoria",
}


class InvalidInput(ValueError):
    """Entrada inválida (unidad, rango o fecha)."""


@dataclass(frozen=True)
class WaterInput:
    """Agua entregable a la parcela, declarada. `no_se` es una respuesta válida."""

    mode: Literal["conozco", "no_se"] = "no_se"
    allocation_m3: float | None = None
    allocation_period: Literal["mensual", "anual"] = "mensual"
    efficiency: float | None = None  # fracción (0, 1]
    delivery_point: str | None = None
    # Respuestas sencillas: «recibo al menos X» / «recibo menos de X» (m³ por mes, toda la parcela).
    allocation_min_m3: float | None = None
    allocation_max_m3: float | None = None
    method: IrrigationMethod | None = None

    def validate(self) -> None:
        for v in (self.allocation_m3, self.allocation_min_m3, self.allocation_max_m3):
            if v is not None and v < 0:
                raise InvalidInput("La dotación no puede ser negativa")
        if self.efficiency is not None and not (0 < self.efficiency <= 1):
            raise InvalidInput("La eficiencia de riego es una fracción entre 0 y 1 (p. ej. 0,85)")
        if self.mode == "conozco" and self.allocation_m3 is None:
            raise InvalidInput("Si conoces la dotación, indica el volumen")
        if self.allocation_min_m3 is not None and self.allocation_max_m3 is not None and self.allocation_min_m3 > self.allocation_max_m3:
            raise InvalidInput("El mínimo de agua no puede superar el máximo")

    def bounds(self) -> tuple[float | None, float | None]:
        """Intervalo mensual conocido: exacto si se declaró el volumen; si no, los límites respondidos."""
        if self.mode == "conozco" and self.allocation_m3 is not None:
            return self.allocation_m3, self.allocation_m3
        return self.allocation_min_m3, self.allocation_max_m3


@dataclass(frozen=True)
class SoilInput:
    ece_ds_m: float | None = None  # conductividad eléctrica del extracto de saturación
    ph: float | None = None
    organic_matter_pct: float | None = None
    analysis_date: date | None = None
    depth_cm: str | None = None
    method: str | None = None
    kind: Kind = "declarado"
    # Observación sencilla del agricultor cuando no hay análisis («¿ves costras blancas?»).
    salinity_signs: Literal["sin_signos", "con_signos"] | None = None

    def validate(self) -> None:
        if self.ece_ds_m is not None and self.ece_ds_m < 0:
            raise InvalidInput("La conductividad eléctrica no puede ser negativa")
        if self.ph is not None and not (0 < self.ph < 14):
            raise InvalidInput("pH fuera de rango")
        measured = any(v is not None for v in (self.ece_ds_m, self.ph, self.organic_matter_pct))
        if measured and self.kind == "observado" and (self.analysis_date is None or not self.method):
            raise InvalidInput("Un análisis medido requiere fecha y método")


@dataclass(frozen=True)
class EconomicOverride:
    crop_id: str
    yield_t_ha: float | None = None
    price_soles_kg: float | None = None
    variable_cost_soles_ha: float | None = None
    # «perfil»: escrito en el perfil; «cuaderno»: derivado de los registros del agricultor (R17).
    origin: Literal["perfil", "cuaderno"] = "perfil"
    note: str = ""


@dataclass(frozen=True)
class ZoneContext:
    """Zona piloto con la que se evalúa: textos y fuentes de sus supuestos (sin valores de otra zona)."""

    id: str = "majes"
    name: str = "Majes I"
    nasa_source_id: str = "NASA-POWER"
    zone_source_id: str = "ZONA-MAJES"
    water_label: str | None = None  # p. ej. «22 500 m³/ha/año (AUTODEMA 2023)»; None si no hay valor típico
    water_source_ids: tuple[str, ...] = ()
    local_water_source_ids: tuple[str, ...] = ("AGUA-LOCAL",)
    default_method: str | None = None
    default_efficiency: float | None = None


@dataclass(frozen=True)
class ParcelInput:
    area_ha: float
    in_pilot_zone: bool
    current_crop_id: str
    current_status: Literal["en_campo", "cosechado"]
    expected_harvest: date | None
    planned_next_crop_id: str | None
    water: WaterInput
    soil: SoilInput
    priority: Priority
    budget_soles: float | None
    residue_management: Literal["incorporar", "retirar", "no_se"]
    economic_overrides: tuple[EconomicOverride, ...] = ()
    reference_date: date = field(default_factory=date.today)
    # Campos completados con supuestos de zona (p. ej. "water.allocation", "water.efficiency").
    assumed: frozenset[str] = frozenset()
    zone: ZoneContext = field(default_factory=ZoneContext)

    def validate(self) -> None:
        if not (self.area_ha > 0):
            raise InvalidInput("El área debe ser positiva")
        if self.area_ha > 10_000:
            raise InvalidInput("Área fuera de rango para una parcela")
        if self.budget_soles is not None and self.budget_soles < 0:
            raise InvalidInput("El presupuesto no puede ser negativo")
        for o in self.economic_overrides:
            for v in (o.yield_t_ha, o.price_soles_kg, o.variable_cost_soles_ha):
                if v is not None and v < 0:
                    raise InvalidInput("Costos, precios y rendimientos no pueden ser negativos")
        self.water.validate()
        self.soil.validate()


@dataclass
class Metric:
    id: str
    label: str
    value: float | None
    unit: str
    kind: Kind
    method: str
    source_ids: list[str] = field(default_factory=list)
    detail: str = ""


@dataclass
class Reason:
    rule_id: str
    state: ReasonState
    message: str
    metric_ids: list[str] = field(default_factory=list)
    source_ids: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    # Supuestos de zona de los que depende esta regla (vacío = solo datos declarados/medidos).
    assumed_inputs: list[str] = field(default_factory=list)


@dataclass
class TimelineBlock:
    kind: Literal["preparacion", "espera", "cultivo", "descanso"]
    start: date
    end: date
    crop_id: str | None = None
    label: str = ""
    stages: list[dict[str, Any]] = field(default_factory=list)
    why: list[str] = field(default_factory=list)


@dataclass
class StrategyAssessment:
    strategy_id: str
    name: str
    short: str
    status: Status
    sequence: list[str]
    timeline: list[TimelineBlock]
    metrics: dict[str, Metric]
    reasons: list[Reason]
    assumptions: list[str]
    missing: list[str]
    monthly_water: list[dict[str, Any]]
    soil: dict[str, Any]
    summary: str
    rank: int | None = None
    simple: dict[str, Any] = field(default_factory=dict)
    decisive: list[dict[str, Any]] = field(default_factory=list)
    # Monte Carlo (año NASA, precio, rendimiento) y precio de equilibrio; None sin economía completa.
    risk: dict[str, Any] | None = None


@dataclass
class ComparisonResult:
    engine_version: str
    catalog_version: str
    climate_snapshot_id: str | None
    priority: Priority
    horizon_start: date
    horizon_end: date
    strategies: list[StrategyAssessment]
    ordering: dict[str, Any]
    associations: list[dict[str, Any]]
    notes: list[str]
    blocking: list[str]
    simple_order: list[str] = field(default_factory=list)
    assumed: list[str] = field(default_factory=list)
    # Resumen del optimizador (método, reparto de la chacra, precio de cambio); None si no corrió.
    optimizer: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return _jsonable(asdict(self))


def _jsonable(x: Any) -> Any:
    if isinstance(x, dict):
        return {k: _jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_jsonable(v) for v in x]
    if isinstance(x, date):
        return x.isoformat()
    if isinstance(x, float):
        return round(x, 4)
    return x
