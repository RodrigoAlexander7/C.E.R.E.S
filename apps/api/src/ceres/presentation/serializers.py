from __future__ import annotations

from ceres.infrastructure.db import models as m


def iso(x):
    return x.isoformat() if x is not None else None


def parcel(p: m.Parcel, active: bool = False) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "geometry": p.geometry,
        "point": p.point,
        "area_ha": p.area_ha,
        "area_origin": p.area_origin,
        "region_codes": p.region_codes,
        "in_pilot_zone": p.in_pilot_zone,
        "zone_id": p.zone_id,
        "active_revision_id": p.active_revision_id,
        "is_active": active,
        "is_public_demo": p.is_public_demo,
        "created_at": iso(p.created_at),
    }


def revision(r: m.ParcelProfileRevision) -> dict:
    return {"id": r.id, "number": r.number, "profile": r.data, "note": r.note, "created_at": iso(r.created_at)}


def crop_event(e: m.CropEvent) -> dict:
    return {
        "id": e.id,
        "crop_id": e.crop_id,
        "variety": e.variety,
        "destination": e.destination,
        "sowing_date": iso(e.sowing_date),
        "expected_harvest": iso(e.expected_harvest),
        "actual_harvest": iso(e.actual_harvest),
        "status": e.status,
        "area_ha": e.area_ha,
        "origin": e.origin,
        "supersedes_id": e.supersedes_id,
        "created_at": iso(e.created_at),
    }


def soil(o: m.SoilObservation) -> dict:
    return {
        "id": o.id,
        "sampled_on": iso(o.sampled_on),
        "depth_cm": o.depth_cm,
        "method": o.method,
        "lab": o.lab,
        "parameters": o.parameters,
        "origin": o.origin,
        "created_at": iso(o.created_at),
    }


def management(r: m.ManagementRecord) -> dict:
    return {
        "id": r.id,
        "kind": r.kind,
        "description": r.description,
        "quantity": r.quantity,
        "unit": r.unit,
        "composition": r.composition,
        "applied_on": iso(r.applied_on),
        "cost_soles": r.cost_soles,
        "origin": r.origin,
        "created_at": iso(r.created_at),
    }


def run_summary(r: m.RecommendationRun) -> dict:
    return {
        "id": r.id,
        "parcel_id": r.parcel_id,
        "revision_id": r.revision_id,
        "scenario_label": r.scenario_label,
        "priority": r.result.get("priority"),
        "statuses": {s["strategy_id"]: s["status"] for s in r.result.get("strategies", [])},
        "engine_version": r.engine_version,
        "catalog_version": r.catalog_version,
        "dataset_snapshot_id": r.dataset_snapshot_id,
        "created_at": iso(r.created_at),
    }


def run_full(r: m.RecommendationRun, current_revision_id: str | None) -> dict:
    return {
        **run_summary(r),
        "inputs": r.inputs,
        "dataset_sha256": r.dataset_sha256,
        "result": r.result,
        "profile_changed": current_revision_id is not None and current_revision_id != r.revision_id,
    }


def message(msg: m.Message) -> dict:
    return {"id": msg.id, "role": msg.role, "content": msg.content, "payload": msg.payload, "provider_status": msg.provider_status, "created_at": iso(msg.created_at)}
