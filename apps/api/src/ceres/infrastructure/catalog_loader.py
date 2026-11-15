"""Carga del catálogo versionado y del registro de fuentes desde `data/`."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from ceres.domain.catalog import (
    AssociationProfile,
    Catalog,
    CropProfile,
    Economics,
    StrategyTemplate,
    ThermalRule,
    Window,
)


def _md(s: str) -> tuple[int, int]:
    m, d = s.split("-")
    return int(m), int(d)


def parse_catalog(data: dict) -> Catalog:
    crops = {}
    for c in data["crops"]:
        e = c["economics"]
        crops[c["id"]] = CropProfile(
            id=c["id"],
            name=c["name"],
            family=c["family"],
            is_legume=c["is_legume"],
            destination=c["destination"],
            stage_days=tuple(c["stage_days"]),
            kc_ini=c["kc"]["ini"],
            kc_mid=c["kc"]["mid"],
            kc_end=c["kc"]["end"],
            stage_status=c["stage_status"],
            stage_source_ids=tuple(c["stage_source_ids"]),
            kc_source_ids=tuple(c["kc_source_ids"]),
            windows=tuple(Window(_md(w["start"]), _md(w["end"])) for w in c["windows"]),
            window_status=c["window_status"],
            window_source_ids=tuple(c["window_source_ids"]),
            salinity_ece_threshold=c["salinity"]["ece_threshold"],
            salinity_ece_50=c["salinity"]["ece_50"],
            salinity_source_ids=tuple(c["salinity"]["source_ids"]),
            thermal_rules=tuple(
                ThermalRule(
                    id=r["id"],
                    label=r["label"],
                    stages=tuple(r["stages"]),
                    variable=r["variable"],
                    comparator=r["comparator"],
                    threshold_c=r["threshold_c"],
                    status=r["status"],
                    source_ids=tuple(r["source_ids"]),
                    note=r["note"],
                )
                for r in c["thermal_rules"]
            ),
            economics=Economics(
                yield_t_ha=e.get("yield_t_ha"),
                price_soles_kg=e.get("price_soles_kg"),
                variable_cost_soles_ha=e.get("variable_cost_soles_ha"),
                status=e["status"],
                price_label=e["price_label"],
                note=e["note"],
                source_ids=tuple(e.get("source_ids", ())),
            ),
            residue_note=c["residue_note"],
            nutrition_note=c["nutrition_note"],
            kc_note=c.get("kc_note", ""),
            short=c.get("short", ""),
            hint=c.get("hint", ""),
        )
    if sum(1 for c in crops.values() if c.id == "trigo" and c.is_legume):
        raise ValueError("El trigo no es una leguminosa fijadora")
    cat = Catalog(
        version=data["version"],
        crops=crops,
        associations=tuple(
            AssociationProfile(
                id=a["id"],
                name=a["name"],
                components=tuple(a["components"]),
                structure=a["structure"],
                status=a["status"],
                known=tuple(a["known"]),
                missing=tuple(a["missing"]),
                source_ids=tuple(a["source_ids"]),
                warning=a["warning"],
            )
            for a in data["associations"]
        ),
        templates=tuple(
            StrategyTemplate(
                id=t["id"],
                name=t["name"],
                short=t["short"],
                sequence_rule=t["sequence_rule"],
                cap_status=t["cap_status"],
                rationale=t["rationale"],
                source_ids=tuple(t["source_ids"]),
                crops=tuple(t.get("crops", ())),
            )
            for t in data["templates"]
        ),
        prep_days=data["prep_days"],
        prep_status=data["prep_status"],
        transition_cost_soles_ha=data.get("transition_cost_soles_ha"),
        transition_cost_status=data["transition_cost_status"],
        horizon_months=data["horizon_months"],
        scenario_low=(data["scenario_low"]["yield_factor"], data["scenario_low"]["price_factor"]),
        scenario_high=(data["scenario_high"]["yield_factor"], data["scenario_high"]["price_factor"]),
        non_catalog_crops=data.get("non_catalog_crops", {}),
        non_catalog_hints=data.get("non_catalog_hints", {}),
    )
    for t in cat.templates:
        if t.sequence_rule == "alternar" and (len(t.crops) < 2 or any(c not in crops for c in t.crops)):
            raise ValueError(f"La plantilla {t.id} alterna cultivos sin ficha en el catálogo")
    return cat


@lru_cache
def load_catalog(path: Path) -> Catalog:
    return parse_catalog(json.loads(path.read_text()))


@lru_cache
def load_sources_file(path: Path) -> dict:
    return json.loads(path.read_text())
