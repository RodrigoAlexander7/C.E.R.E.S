"""Carga idempotente: fuentes, fichas, instantánea NASA y caso público de demostración (supuestos etiquetados)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from ceres.config import Settings
from ceres.infrastructure.db import models as m
from ceres.infrastructure.security import hash_password, new_token

DEMO_EMAIL = "demo-publico@ceres.invalid"
DEMO_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[-72.1911, -16.3510], [-72.1890, -16.3510], [-72.1890, -16.3490], [-72.1911, -16.3490], [-72.1911, -16.3510]]],
}


def demo_profile(today: date) -> dict:
    return {
        "current_crop_id": "maiz_grano",
        "current_status": "en_campo",
        "expected_harvest": (today + timedelta(days=90)).isoformat(),
        "planned_next_crop_id": None,
        "water": {"mode": "conozco", "allocation_m3": 12000, "allocation_period": "mensual", "efficiency": 0.85, "delivery_point": "toma de la parcela", "origin": "supuesto_demo"},
        "soil": {"ece_ds_m": 0.9, "ph": 7.6, "organic_matter_pct": 1.1, "analysis_date": (today - timedelta(days=150)).isoformat(), "depth_cm": "0-30", "method": "extracto de saturación (supuesto)", "kind": "supuesto_demo"},
        "priority": "equilibrada",
        "budget_soles": None,
        "residue_management": "incorporar",
        "economic_overrides": [],
    }


def sync_sources(db, sources_file: dict) -> int:
    version = sources_file["version"]
    for s in sources_file["sources"]:
        row = db.get(m.SourceRecord, s["id"]) or m.SourceRecord(id=s["id"])
        row.institution, row.title, row.url, row.section = s["institution"], s["title"], s.get("url"), s.get("section")
        row.scope, row.kind, row.status = s.get("scope"), s["kind"], s.get("status")
        row.is_public, row.owner_id, row.registry_version = True, None, version
        db.merge(row)
    db.flush()
    for f in sources_file["fragments"]:
        row = db.get(m.EvidenceFragment, f["id"]) or m.EvidenceFragment(id=f["id"])
        row.source_id, row.title, row.text = f["source_id"], f["title"], f["text"]
        row.is_public, row.owner_id, row.registry_version = True, None, version
        db.merge(row)
    return len(sources_file["sources"])


def run_seed(settings: Settings) -> dict:
    from ceres.bootstrap import build_container
    from ceres.infrastructure.db.repositories import ParcelRepo
    from ceres.presentation.app import create_run, lima_today

    c = build_container(settings)
    report: dict = {}
    with c.sessions() as db:
        report["sources"] = sync_sources(db, c.sources_file)
        if c.snapshot:
            snap = db.get(m.DatasetSnapshot, c.snapshot.snapshot_id) or m.DatasetSnapshot(id=c.snapshot.snapshot_id)
            snap.provider, snap.sha256 = "NASA POWER", c.snapshot.sha256
            snap.file_path, snap.summary = settings.nasa_snapshot_file, c.snapshot.public_summary()
            db.merge(snap)
            report["nasa_snapshot"] = c.snapshot.snapshot_id
        else:
            report["nasa_snapshot"] = f"NO DISPONIBLE: {c.nasa_error}"

        user = db.scalar(select(m.User).where(m.User.email == DEMO_EMAIL))
        if user is None:
            user = m.User(email=DEMO_EMAIL, password_hash=hash_password(new_token()))  # sin acceso por login
            db.add(user)
            db.flush()
        repo = ParcelRepo(db, user.id)
        parcel = db.scalar(select(m.Parcel).where(m.Parcel.is_public_demo.is_(True), m.Parcel.deleted_at.is_(None)))
        if parcel is None:
            from ceres.infrastructure.geometry import centroid, geodesic_area_ha

            pt = centroid(DEMO_POLYGON)
            d = c.regions.locate_point(pt["lat"], pt["lon"])
            parcel = repo.add(
                m.Parcel(
                    name="Caso público de demostración — Majes I",
                    geometry=DEMO_POLYGON,
                    point=pt,
                    area_ha=round(geodesic_area_ha(DEMO_POLYGON), 4),
                    area_origin="geodesica",
                    region_codes={"district_code": d["code"], "district_name": d["name"], "provider": d["provenance"]["provider"]} if d else {},
                    in_pilot_zone=bool(d and d["code"] == "040520"),
                    is_public_demo=True,
                )
            )
            repo.add_revision(parcel, demo_profile(lima_today()), "Caso de demostración: todos los datos de parcela son supuestos etiquetados")
            repo.add_event(m.CropEvent(parcel_id=parcel.id, crop_id="maiz_grano", status="en_campo", origin="supuesto_demo"))
        from ceres.domain.engine import ENGINE_VERSION

        latest = repo.runs(parcel.id)[:1]
        current = (c.catalog.version, c.climate.snapshot_id, ENGINE_VERSION)
        if latest and (latest[0].catalog_version, latest[0].dataset_snapshot_id, latest[0].engine_version) == current:
            run = latest[0]  # idempotente: no duplica el run de demostración
        else:
            run = create_run(c, repo, parcel, None)
        report["demo_parcel"] = parcel.id
        report["demo_run"] = run.id
        report["demo_statuses"] = {s["strategy_id"]: s["status"] for s in run.result["strategies"]}
        db.commit()
    return report
