"""Casos de uso del motor: construir entradas congeladas desde el perfil y crear runs inmutables."""

from __future__ import annotations

from datetime import date

from ceres.domain.catalog import Catalog
from ceres.domain.engine import ClimateInput, evaluate
from ceres.domain.model import (
    ComparisonResult,
    EconomicOverride,
    ParcelInput,
    SoilInput,
    WaterInput,
)


def _d(x) -> date | None:
    if x in (None, ""):
        return None
    return x if isinstance(x, date) else date.fromisoformat(x)


def apply_scenario(profile: dict, scenario: dict | None) -> tuple[dict, str | None]:
    """Aplica cambios de simulación (agua, fecha, prioridad) sin modificar la revisión guardada."""
    if not scenario:
        return profile, None
    p = {**profile, "water": {**profile.get("water", {})}}
    labels = []
    if scenario.get("priority"):
        p["priority"] = scenario["priority"]
        labels.append(f"prioridad {scenario['priority']}")
    if scenario.get("water_mode"):
        p["water"]["mode"] = scenario["water_mode"]
        labels.append("agua: no sé" if scenario["water_mode"] == "no_se" else "agua declarada")
    if scenario.get("allocation_m3") is not None:
        p["water"]["mode"] = "conozco"
        p["water"]["allocation_m3"] = scenario["allocation_m3"]
        p["water"]["allocation_period"] = "mensual"
        labels.append(f"dotación {scenario['allocation_m3']:,.0f} m³/mes")
    if scenario.get("efficiency") is not None:
        p["water"]["efficiency"] = scenario["efficiency"]
        labels.append(f"eficiencia {scenario['efficiency']:g}")
    if scenario.get("expected_harvest"):
        p["expected_harvest"] = scenario["expected_harvest"]
        p["current_status"] = "en_campo"
        labels.append(f"cosecha actual {scenario['expected_harvest']}")
    return p, ", ".join(labels) or None


def parcel_input(profile: dict, area_ha: float, in_pilot: bool, reference_date: date) -> ParcelInput:
    w = profile.get("water") or {}
    s = profile.get("soil") or {}
    return ParcelInput(
        area_ha=area_ha,
        in_pilot_zone=in_pilot,
        current_crop_id=profile["current_crop_id"],
        current_status=profile["current_status"],
        expected_harvest=_d(profile.get("expected_harvest")),
        planned_next_crop_id=profile.get("planned_next_crop_id") or None,
        water=WaterInput(
            mode=w.get("mode", "no_se"),
            allocation_m3=w.get("allocation_m3"),
            allocation_period=w.get("allocation_period", "mensual"),
            efficiency=w.get("efficiency"),
            delivery_point=w.get("delivery_point"),
        ),
        soil=SoilInput(
            ece_ds_m=s.get("ece_ds_m"),
            ph=s.get("ph"),
            organic_matter_pct=s.get("organic_matter_pct"),
            analysis_date=_d(s.get("analysis_date")),
            depth_cm=s.get("depth_cm"),
            method=s.get("method"),
            kind=s.get("kind", "declarado"),
        ),
        priority=profile.get("priority", "equilibrada"),
        budget_soles=profile.get("budget_soles"),
        residue_management=profile.get("residue_management", "no_se"),
        economic_overrides=tuple(EconomicOverride(**o) for o in profile.get("economic_overrides", [])),
        reference_date=reference_date,
    )


def frozen_inputs(profile: dict, area_ha: float, in_pilot: bool, reference_date: date) -> dict:
    return {"profile": profile, "area_ha": area_ha, "in_pilot_zone": in_pilot, "reference_date": reference_date.isoformat()}


def evaluate_frozen(inputs: dict, catalog: Catalog, climate: ClimateInput) -> ComparisonResult:
    """Reproduce un resultado desde sus entradas congeladas."""
    p = parcel_input(inputs["profile"], inputs["area_ha"], inputs["in_pilot_zone"], date.fromisoformat(inputs["reference_date"]))
    return evaluate(p, catalog, climate)
