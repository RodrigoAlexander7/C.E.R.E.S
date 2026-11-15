"""Carga idempotente: fuentes, fichas, instantáneas NASA por zona y un caso público de demostración por zona
(todos sus datos de parcela son supuestos etiquetados)."""

from __future__ import annotations

import copy
from datetime import date, timedelta

from sqlalchemy import select

from ceres.config import Settings
from ceres.infrastructure.db import models as m
from ceres.infrastructure.security import hash_password, new_token

DEMO_EMAIL = "demo-publico@ceres.invalid"


def demo_profile(demo: dict, today: date) -> dict:
    p = copy.deepcopy(demo["profile"])
    if p.get("current_status") == "en_campo" and demo.get("harvest_in_days") is not None:
        p["expected_harvest"] = (today + timedelta(days=demo["harvest_in_days"])).isoformat()
    if p.get("soil", {}).get("kind") and demo.get("soil_analysis_days_ago") is not None:
        p["soil"]["analysis_date"] = (today - timedelta(days=demo["soil_analysis_days_ago"])).isoformat()
    return p


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
    from ceres.domain.engine import ENGINE_VERSION
    from ceres.infrastructure.db.repositories import ParcelRepo
    from ceres.infrastructure.geometry import centroid, geodesic_area_ha
    from ceres.presentation.app import create_run, lima_today

    c = build_container(settings)
    report: dict = {"zones": {}}
    with c.sessions() as db:
        report["sources"] = sync_sources(db, c.sources_file)
        user = db.scalar(select(m.User).where(m.User.email == DEMO_EMAIL))
        if user is None:
            user = m.User(email=DEMO_EMAIL, password_hash=hash_password(new_token()))  # sin acceso por login
            db.add(user)
            db.flush()
        repo = ParcelRepo(db, user.id)
        # Demo creada antes del registro de zonas: pertenecía a Majes I.
        for old in db.scalars(select(m.Parcel).where(m.Parcel.is_public_demo.is_(True), m.Parcel.zone_id.is_(None), m.Parcel.in_pilot_zone.is_(True))):
            old.zone_id = "majes"
        db.flush()

        for z in c.zones.zones.values():
            zr: dict = {}
            if z.snapshot:
                snap = db.get(m.DatasetSnapshot, z.snapshot.snapshot_id) or m.DatasetSnapshot(id=z.snapshot.snapshot_id)
                snap.provider, snap.sha256 = "NASA POWER", z.snapshot.sha256
                snap.file_path, snap.summary = z.nasa_file, z.snapshot.public_summary() | {"zone_id": z.id, "source_id": z.climate.source_id}
                db.merge(snap)
                zr["nasa_snapshot"] = z.snapshot.snapshot_id
            else:
                zr["nasa_snapshot"] = f"NO DISPONIBLE: {z.nasa_error}"
            demo = z.data.get("demo")
            if not demo:
                report["zones"][z.id] = zr
                continue
            parcel = repo.db.scalar(
                select(m.Parcel).where(m.Parcel.is_public_demo.is_(True), m.Parcel.zone_id == z.id, m.Parcel.deleted_at.is_(None))
            )
            if parcel is None:
                poly = demo["polygon"]
                pt = centroid(poly)
                d = c.regions.locate_point(pt["lat"], pt["lon"])
                located = c.zones.zone_of_district(d["code"]) if d else None
                if located is None or located.id != z.id:
                    raise RuntimeError(f"El polígono demo de {z.id} no cae en un distrito de la zona")
                parcel = repo.add(
                    m.Parcel(
                        name=demo["name"],
                        geometry=poly,
                        point=pt,
                        area_ha=round(geodesic_area_ha(poly), 4),
                        area_origin="geodesica",
                        region_codes={"district_code": d["code"], "district_name": d["name"], "provider": d["provenance"]["provider"]},
                        in_pilot_zone=True,
                        zone_id=z.id,
                        is_public_demo=True,
                    )
                )
                prof = demo_profile(demo, lima_today())
                repo.add_revision(parcel, prof, demo["note"])
                repo.add_event(m.CropEvent(parcel_id=parcel.id, crop_id=prof["current_crop_id"], status=prof["current_status"], origin="supuesto_demo"))
            elif parcel.geometry != demo["polygon"]:
                # El contorno del demo cambió en data/zonas/<zona>/zona.json (p. ej. a un lote regado verificado):
                # se actualiza el lote existente. Las observaciones NDVI viejas quedan, filtradas por su hash.
                poly = demo["polygon"]
                pt = centroid(poly)
                d = c.regions.locate_point(pt["lat"], pt["lon"])
                located = c.zones.zone_of_district(d["code"]) if d else None
                if located is None or located.id != z.id:
                    raise RuntimeError(f"El polígono demo de {z.id} no cae en un distrito de la zona")
                parcel.geometry, parcel.point = poly, pt
                parcel.area_ha = round(geodesic_area_ha(poly), 4)
                parcel.region_codes = {"district_code": d["code"], "district_name": d["name"], "provider": d["provenance"]["provider"]}
                db.flush()
                zr["demo_geometry_updated"] = True
            latest = repo.runs(parcel.id)[:1]
            # Copia real previamente calculada: el seed no descarga escenas ni usa datos sintéticos.
            import json
            from ceres.infrastructure.hls import geometry_hash
            pack = settings.data_dir / "hls" / "demo_ndvi.json"
            if pack.exists():
                hls = json.loads(pack.read_text())["zones"].get(z.id)
                if hls and hls["geometry_hash"] == geometry_hash(parcel.geometry):
                    for observation in hls["observations"]:
                        exists = db.scalar(select(m.NdviObservation).where(m.NdviObservation.parcel_id == parcel.id,
                            m.NdviObservation.scene_id == observation["scene_id"], m.NdviObservation.geometry_hash == hls["geometry_hash"]))
                        if not exists:
                            db.add(m.NdviObservation(owner_id=parcel.owner_id, parcel_id=parcel.id,
                                scene_id=observation["scene_id"], observed_on=date.fromisoformat(observation["observed_on"]),
                                geometry_hash=hls["geometry_hash"], data=observation | {"fetched_at": json.loads(pack.read_text())["fetched_at"]}))
            current = (z.catalog.version, z.climate.snapshot_id, ENGINE_VERSION)
            if latest and (latest[0].catalog_version, latest[0].dataset_snapshot_id, latest[0].engine_version) == current:
                run = latest[0]  # idempotente: no duplica el run de demostración
            else:
                run = create_run(c, repo, parcel, None)
            zr.update(
                demo_parcel=parcel.id,
                demo_run=run.id,
                demo_statuses={s["strategy_id"]: s["status"] for s in run.result["strategies"]},
            )
            report["zones"][z.id] = zr
        db.commit()
    return report
