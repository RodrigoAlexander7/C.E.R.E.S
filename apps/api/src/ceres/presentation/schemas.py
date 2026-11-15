"""Contratos HTTP (Pydantic). Validan unidades, rangos y tamaños antes de llegar a los casos de uso."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Forma del identificador; que el cultivo exista en el catálogo de la ZONA se comprueba en la ruta.
CROP_ID = r"^[a-z][a-z_]{1,39}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Strict):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=200)

    @field_validator("email")
    @classmethod
    def norm_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or v.startswith("@") or v.endswith("@") or " " in v:
            raise ValueError("Email no válido")
        return v


class WaterData(Strict):
    mode: Literal["conozco", "no_se"] = "no_se"
    allocation_m3: float | None = Field(None, ge=0, le=10_000_000)
    allocation_period: Literal["mensual", "anual"] = "mensual"
    efficiency: float | None = Field(None, gt=0, le=1)
    delivery_point: str | None = Field(None, max_length=120)
    origin: Literal["declarado", "supuesto_demo"] = "declarado"
    allocation_min_m3: float | None = Field(None, ge=0, le=10_000_000)
    allocation_max_m3: float | None = Field(None, ge=0, le=10_000_000)
    method: Literal["goteo", "aspersion", "gravedad"] | None = None


class SoilData(Strict):
    ece_ds_m: float | None = Field(None, ge=0, le=60)
    ph: float | None = Field(None, gt=0, lt=14)
    organic_matter_pct: float | None = Field(None, ge=0, le=100)
    analysis_date: date | None = None
    depth_cm: str | None = Field(None, max_length=20)
    method: str | None = Field(None, max_length=120)
    kind: Literal["observado", "declarado", "supuesto_demo"] = "declarado"
    salinity_signs: Literal["sin_signos", "con_signos"] | None = None


class EconomicOverrideData(Strict):
    crop_id: str = Field(pattern=CROP_ID)
    yield_t_ha: float | None = Field(None, ge=0, le=200)
    price_soles_kg: float | None = Field(None, ge=0, le=100)
    variable_cost_soles_ha: float | None = Field(None, ge=0, le=500_000)


class ProfileData(Strict):
    current_crop_id: str = Field(pattern=CROP_ID)
    current_status: Literal["en_campo", "cosechado"]
    expected_harvest: date | None = None
    planned_next_crop_id: str | None = Field(None, pattern=CROP_ID)
    water: WaterData = WaterData()
    soil: SoilData = SoilData()
    priority: Literal["dinero", "agua", "suelo", "equilibrada"] = "equilibrada"
    budget_soles: float | None = Field(None, ge=0, le=100_000_000)
    residue_management: Literal["incorporar", "retirar", "no_se"] = "no_se"
    economic_overrides: list[EconomicOverrideData] = Field(default_factory=list, max_length=5)
    # Completar datos desconocidos con supuestos de la zona piloto (R16).
    use_zone_defaults: bool = True


class PointData(Strict):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ParcelCreate(Strict):
    name: str | None = Field(None, max_length=120)
    geometry: dict | None = None
    point: PointData | None = None
    area_ha: float | None = Field(None, gt=0, le=10_000)
    region_id: str | None = Field(None, max_length=20)
    profile: ProfileData


class ParcelPatch(Strict):
    name: str | None = Field(None, max_length=120)
    geometry: dict | None = None  # dibujar o corregir el contorno del lote (misma zona piloto)


class RevisionCreate(Strict):
    profile: ProfileData
    note: str | None = Field(None, max_length=300)


class CropEventCreate(Strict):
    crop_id: str = Field(pattern=CROP_ID)
    variety: str | None = Field(None, max_length=120)
    destination: str | None = Field(None, max_length=120)
    sowing_date: date | None = None
    expected_harvest: date | None = None
    actual_harvest: date | None = None
    status: Literal["en_campo", "cosechado"]
    area_ha: float | None = Field(None, gt=0, le=10_000)
    supersedes_id: str | None = Field(None, max_length=32)


class SoilCreate(Strict):
    sampled_on: date
    depth_cm: str = Field(max_length=20)
    method: str = Field(max_length=120)
    lab: str | None = Field(None, max_length=120)
    ece_ds_m: float | None = Field(None, ge=0, le=60)
    ph: float | None = Field(None, gt=0, lt=14)
    organic_matter_pct: float | None = Field(None, ge=0, le=100)
    origin: Literal["observado", "declarado"] = "observado"


class ManagementCreate(Strict):
    kind: Literal["abono", "fertilizante", "residuos", "otro"]
    description: str = Field(min_length=2, max_length=300)
    quantity: float | None = Field(None, ge=0, le=1_000_000)
    unit: str | None = Field(None, max_length=20)
    composition: str | None = Field(None, max_length=200)
    applied_on: date | None = None
    cost_soles: float | None = Field(None, ge=0, le=10_000_000)


class Scenario(Strict):
    priority: Literal["dinero", "agua", "suelo", "equilibrada"] | None = None
    water_mode: Literal["conozco", "no_se"] | None = None
    allocation_m3: float | None = Field(None, ge=0, le=10_000_000)
    efficiency: float | None = Field(None, gt=0, le=1)
    expected_harvest: date | None = None


class RunCreate(Strict):
    scenario: Scenario | None = None


class QuickCompare(Strict):
    """Modo sencillo sin cuenta: perfil mínimo + área (por defecto, área de ejemplo de 5 ha)."""

    profile: ProfileData
    area_ha: float = Field(5, gt=0, le=10_000)
    zone_id: str | None = Field(None, pattern=r"^[a-z][a-z_]{1,29}$")


class AreaRequest(Strict):
    geometry: dict


class ConversationCreate(Strict):
    run_id: str = Field(max_length=32)


class MessageCreate(Strict):
    question: str = Field(min_length=2, max_length=600)
