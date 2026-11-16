"""Casos de uso del motor: supuestos de zona, entradas congeladas y runs inmutables."""

from __future__ import annotations

import copy
from datetime import date
from typing import Protocol

from ceres.domain.catalog import Catalog
from ceres.domain.engine import ENGINE_VERSION, ClimateInput, evaluate
from ceres.domain.nutrition import nutrition_impact
from ceres.domain.model import (
    ComparisonResult,
    EconomicOverride,
    ParcelInput,
    SoilInput,
    WaterInput,
    ZoneContext,
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
    "water.availability",
    "soil.salinity_signs",
    "priority",
}

# Escenarios metodológicos CERES, no conversión medida ni equivalencia validada.
# Las cotas abiertas conservan el desconocimiento (nunca se transforman en cero).
WATER_SCENARIOS = {
    "muy_poca": (None, 0.35),
    "poca": (0.35, 0.65),
    "media": (0.65, 1.0),
    "alta": (1.0, 1.35),
    "no_es_problema": (1.35, None),
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
    """Completa SOLO datos desconocidos con supuestos de la zona (R16). Devuelve (perfil efectivo, campos supuestos).

    Una zona sin valor típico publicado (p. ej. agua) no rellena ese dato: queda desconocido.
    """
    if not zone or profile.get("use_zone_defaults", True) is False:
        return profile, []
    p = copy.deepcopy(profile)
    w = p.setdefault("water", {})
    assumed: list[str] = []
    eff_table = zone.get("efficiency_by_method") or {}
    default_method = (zone.get("default_method") or {}).get("value")
    if w.get("efficiency") is None:
        method = w.get("method")
        if method in eff_table:
            w["efficiency"] = eff_table[method]  # método declarado + referencia FAO: no es supuesto
        elif default_method in eff_table:
            w["efficiency"] = eff_table[default_method]
            assumed.append("water.efficiency")
    knows_exact = w.get("mode") == "conozco" and w.get("allocation_m3") is not None and w.get("allocation_period", "mensual") == "mensual"
    has_bounds = w.get("allocation_min_m3") is not None or w.get("allocation_max_m3") is not None
    typical = (zone.get("water_m3_ha_year") or {}).get("value")
    if typical is not None and not knows_exact and not has_bounds and w.get("allocation_period", "mensual") == "mensual":
        monthly = typical / 12 * area_ha
        if w.get("availability") in WATER_SCENARIOS:
            lo, hi = WATER_SCENARIOS[w["availability"]]
            w.update(mode="no_se", allocation_m3=None,
                     allocation_min_m3=round(monthly * lo, 4) if lo is not None else None,
                     allocation_max_m3=round(monthly * hi, 4) if hi is not None else None)
        else:
            w.update(mode="conozco", allocation_m3=round(monthly), allocation_period="mensual")
        assumed.append("water.allocation")
    return p, assumed


def parcel_input(
    profile: dict, area_ha: float, in_pilot: bool, reference_date: date, assumed: list[str] | None = None,
    zone: ZoneContext | None = None, own_economics: list[dict] | None = None,
) -> ParcelInput:
    overrides = {o["crop_id"]: EconomicOverride(**o) for o in profile.get("economic_overrides", [])}
    # Datos propios del cuaderno (R17): sustituyen a los del perfil y a los de ejemplo, campo a campo.
    for o in own_economics or []:
        prev = overrides.get(o["crop_id"])
        merged = {k: v for k, v in (vars(prev) if prev else {}).items()}
        merged.update({k: v for k, v in o.items() if v is not None})
        merged["origin"] = "cuaderno"
        overrides[o["crop_id"]] = EconomicOverride(**merged)
    w = profile.get("water") or {}
    s = profile.get("soil") or {}
    return ParcelInput(
        area_ha=area_ha,
        in_pilot_zone=in_pilot,
        current_crop_id=profile["current_crop_id"],
        current_status=profile["current_status"],
        current_crop_streak=profile.get("current_crop_streak") or 2,
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
            availability=w.get("availability"),
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
        economic_overrides=tuple(overrides.values()),
        reference_date=reference_date,
        assumed=frozenset(assumed or []),
        zone=zone or ZoneContext(),
    )


class ZoneLike(Protocol):
    """Zona piloto resuelta por la infraestructura (catálogo, clima y supuestos propios)."""

    id: str
    data: dict
    catalog: Catalog
    climate: ClimateInput

    def context(self) -> ZoneContext: ...


def frozen_inputs(
    profile: dict, area_ha: float, in_pilot: bool, reference_date: date, zone: ZoneLike | None = None,
    own_economics: list[dict] | None = None,
    field_context: dict | None = None,
) -> dict:
    """Entradas congeladas: perfil declarado, perfil efectivo con supuestos de zona, la zona y sus versiones."""
    effective, assumed = apply_zone_defaults(profile, area_ha, zone.data if (zone and in_pilot) else None)
    if profile.get("current_crop_streak") is None:
        effective = {**effective, "current_crop_streak": 2}
        assumed.append("current_crop_streak")
    if (profile.get("soil") or {}).get("photo_assessment"):
        assumed.append("soil.salinity_signs")
    extra = getattr(zone, "extra", {}) if zone else {}
    water = profile.get("water") or {}
    scenario = None
    if water.get("availability"):
        scenario = {
            "availability": water["availability"], "kind": "supuesto_zona",
            "factors": WATER_SCENARIOS[water["availability"]],
            "reference": copy.deepcopy((zone.data.get("water_m3_ha_year") or {}) if zone else {}),
            "source_ids": ["CERES-AGUA-CUALITATIVA"],
            "method": "Referencia anual de SU zona / 12 × área geodésica × factores de escenario CERES",
            "limitation": "Respuesta cualitativa declarada; intervalo supuesto, sin equivalencia medida. Confirma los turnos de agua.",
        }
    return {
        "profile": profile,
        "effective_profile": effective,
        "assumed": assumed,
        "zone_id": zone.id if zone else None,
        "zone_version": zone.data.get("version") if zone else None,
        "own_economics": own_economics or [],
        "area_ha": area_ha,
        "in_pilot_zone": in_pilot,
        "reference_date": reference_date.isoformat(),
        "field_verified": field_context.get("verified", False) if field_context is not None else True,
        "field_context": copy.deepcopy(field_context),
        "water_scenario": scenario,
        "nutrition_context": copy.deepcopy(extra.get("nutrition")),
    }


def evaluate_frozen(inputs: dict, zone: ZoneLike | None) -> ComparisonResult:
    """Reproduce un resultado desde sus entradas congeladas con el catálogo y el clima de SU zona."""
    if not inputs.get("field_verified", False) or not inputs["in_pilot_zone"] or zone is None:
        reference = date.fromisoformat(inputs["reference_date"])
        return ComparisonResult(engine_version=ENGINE_VERSION, catalog_version="sin_catalogo_local",
            climate_snapshot_id=None, priority=inputs["profile"].get("priority", "equilibrada"),
            horizon_start=reference, horizon_end=reference, strategies=[], ordering={"ranked": []}, associations=[],
            notes=["Cuaderno, agenda y NDVI disponibles. El calendario agronómico requiere fichas y clima locales."],
            blocking=["Delimita y confirma el contorno de tu campo antes de calcular estimaciones." if not inputs.get("field_verified", False)
                      else "La parcela está fuera de las zonas piloto. Faltan fichas locales para recomendar."])
    profile = inputs.get("effective_profile", inputs["profile"])
    p = parcel_input(
        profile, inputs["area_ha"], inputs["in_pilot_zone"], date.fromisoformat(inputs["reference_date"]),
        inputs.get("assumed"), zone.context(), inputs.get("own_economics"),
    )
    result = evaluate(p, zone.catalog, zone.climate)
    for strategy in result.strategies:
        strategy.nutrition = nutrition_impact(strategy.sequence, inputs.get("nutrition_context"))
    for association in result.associations:
        components = association.get("components") or []
        ids = [x if isinstance(x, str) else x["crop_id"] for x in components]
        association["nutrition"] = nutrition_impact(ids, inputs.get("nutrition_context"))
    if "current_crop_streak" in inputs.get("assumed", []):
        result.notes.append("No conoces la repetición previa: por prudencia se supone que el cultivo actual ya lleva dos campañas seguidas.")
    if inputs.get("water_scenario"):
        result.notes.append(inputs["water_scenario"]["limitation"])
    return result
