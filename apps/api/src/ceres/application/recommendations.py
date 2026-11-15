"""Casos de uso del motor: supuestos de zona, entradas congeladas y runs inmutables."""

from __future__ import annotations

import copy
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


def set_path(profile: dict, path: str, value) -> dict:
    """Aplica un parche «water.allocation_min_m3» = valor sobre una copia del perfil."""
    out = copy.deepcopy(profile)
    head, _, tail = path.partition(".")
    if tail:
        out.setdefault(head, {})
        out[head][tail] = value
    else:
        out[head] = value
    return out


ALLOWED_PATCHES = {
    "water.allocation_min_m3",
    "water.allocation_max_m3",
    "water.method",
    "soil.salinity_signs",
    "priority",
}


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
        if scenario["water_mode"] == "no_se":
            p["water"].update(allocation_m3=None, allocation_min_m3=None, allocation_max_m3=None)
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


def apply_zone_defaults(profile: dict, area_ha: float, zone: dict | None) -> tuple[dict, list[str]]:
    """Completa SOLO datos desconocidos con supuestos de zona (R16). Devuelve (perfil efectivo, campos supuestos)."""
    if not zone or profile.get("use_zone_defaults", True) is False:
        return profile, []
    p = copy.deepcopy(profile)
    w = p.setdefault("water", {})
    assumed: list[str] = []
    eff_table = zone["efficiency_by_method"]
    if w.get("efficiency") is None:
        method = w.get("method")
        if method in eff_table:
            w["efficiency"] = eff_table[method]  # método declarado + referencia FAO: no es supuesto
        else:
            w["efficiency"] = eff_table[zone["default_method"]["value"]]
            assumed.append("water.efficiency")
    knows_exact = w.get("mode") == "conozco" and w.get("allocation_m3") is not None and w.get("allocation_period", "mensual") == "mensual"
    has_bounds = w.get("allocation_min_m3") is not None or w.get("allocation_max_m3") is not None
    if not knows_exact and not has_bounds and w.get("allocation_period", "mensual") == "mensual":
        monthly = zone["water_m3_ha_year"]["value"] / 12 * area_ha
        w.update(mode="conozco", allocation_m3=round(monthly), allocation_period="mensual")
        assumed.append("water.allocation")
    return p, assumed


def parcel_input(profile: dict, area_ha: float, in_pilot: bool, reference_date: date, assumed: list[str] | None = None) -> ParcelInput:
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
            allocation_min_m3=w.get("allocation_min_m3"),
            allocation_max_m3=w.get("allocation_max_m3"),
            method=w.get("method"),
        ),
        soil=SoilInput(
            ece_ds_m=s.get("ece_ds_m"),
            ph=s.get("ph"),
            organic_matter_pct=s.get("organic_matter_pct"),
            analysis_date=_d(s.get("analysis_date")),
            depth_cm=s.get("depth_cm"),
            method=s.get("method"),
            kind=s.get("kind", "declarado"),
            salinity_signs=s.get("salinity_signs"),
        ),
        priority=profile.get("priority", "equilibrada"),
        budget_soles=profile.get("budget_soles"),
        residue_management=profile.get("residue_management", "no_se"),
        economic_overrides=tuple(EconomicOverride(**o) for o in profile.get("economic_overrides", [])),
        reference_date=reference_date,
        assumed=frozenset(assumed or []),
    )


def frozen_inputs(profile: dict, area_ha: float, in_pilot: bool, reference_date: date, zone: dict | None = None) -> dict:
    """Entradas congeladas: perfil declarado, perfil efectivo con supuestos de zona y su versión."""
    effective, assumed = apply_zone_defaults(profile, area_ha, zone)
    return {
        "profile": profile,
        "effective_profile": effective,
        "assumed": assumed,
        "zone_version": zone.get("version") if zone else None,
        "area_ha": area_ha,
        "in_pilot_zone": in_pilot,
        "reference_date": reference_date.isoformat(),
    }


def evaluate_frozen(inputs: dict, catalog: Catalog, climate: ClimateInput) -> ComparisonResult:
    """Reproduce un resultado desde sus entradas congeladas."""
    profile = inputs.get("effective_profile", inputs["profile"])
    p = parcel_input(profile, inputs["area_ha"], inputs["in_pilot_zone"], date.fromisoformat(inputs["reference_date"]), inputs.get("assumed"))
    return evaluate(p, catalog, climate)
