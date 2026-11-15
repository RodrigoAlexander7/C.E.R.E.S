"""NDVI privado y demos públicas; trabajo satelital fuera de la respuesta HTTP."""
from datetime import UTC, date, datetime, timedelta
import threading

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select

from ceres.infrastructure.db import models as m
from ceres.infrastructure.hls import geometry_hash, observe, scenes
from ceres.presentation.deps import ApiError, container, get_db, not_found, parcel_repo

router = APIRouter(prefix="/api/v1")
_worker = threading.Lock()


def refresh(c, job_id: str, geometry: dict, start: date, end: date):
    if not _worker.acquire(blocking=False):
        with c.sessions() as db:
            j = db.get(m.NdviJob, job_id)
            j.status, j.detail = "error", "Ya se procesa otra parcela; vuelve a intentarlo al terminar."
            db.commit()
        return
    try:
        with c.sessions() as db:
            j = db.get(m.NdviJob, job_id)
            j.status = "procesando"
            db.commit()
            items = scenes(geometry, start, end)
            for item in items:
                gh = geometry_hash(geometry)
                existing = db.scalar(select(m.NdviObservation).where(
                    m.NdviObservation.parcel_id == j.parcel_id,
                    m.NdviObservation.scene_id == item["id"], m.NdviObservation.geometry_hash == gh))
                if existing:
                    continue
                data = observe(item, geometry)
                db.add(m.NdviObservation(owner_id=j.owner_id, parcel_id=j.parcel_id,
                    scene_id=item["id"], observed_on=date.fromisoformat(data["observed_on"]),
                    geometry_hash=gh, data=data))
                db.commit()
            j.status = "completo"
            j.detail = f"{len(items)} escenas seleccionadas. Los huecos significan falta de observación válida."
            db.commit()
    except Exception:
        # No registrar URLs SAS ni errores GDAL que puedan contenerlas.
        with c.sessions() as db:
            j = db.get(m.NdviJob, job_id)
            j.status, j.detail = "error", "No se pudo completar HLS. Se conservan las observaciones obtenidas; puedes reintentar."
            db.commit()
    finally:
        _worker.release()


def series(db, parcel):
    if not parcel.geometry:
        return {"items": [], "monthly": [], "job": None, "needs_polygon": True}
    gh = geometry_hash(parcel.geometry)
    rows = db.scalars(select(m.NdviObservation).where(m.NdviObservation.parcel_id == parcel.id,
        m.NdviObservation.owner_id == parcel.owner_id, m.NdviObservation.geometry_hash == gh)
        .order_by(m.NdviObservation.observed_on)).all()
    job = db.scalar(select(m.NdviJob).where(m.NdviJob.parcel_id == parcel.id,
        m.NdviJob.owner_id == parcel.owner_id).order_by(m.NdviJob.created_at.desc()).limit(1))
    if job and job.status in {"pendiente", "procesando"} and job.created_at < datetime.now(UTC) - timedelta(minutes=30):
        job.status, job.detail = "error", "El trabajo se interrumpió. Puedes volver a actualizar."
    import statistics
    months = {}
    for row in rows:
        if row.data["ndvi"] is not None:
            months.setdefault(str(row.observed_on)[:7], []).append(row.data["ndvi"])
    return {"items": [r.data for r in rows], "monthly": [{"month": k, "ndvi": round(statistics.median(v), 4), "scenes": len(v)} for k, v in sorted(months.items())],
        "needs_polygon": False, "job": {"id": job.id, "status": job.status, "detail": job.detail} if job else None}


@router.get("/parcels/{parcel_id}/ndvi")
def read_ndvi(parcel_id: str, repo=Depends(parcel_repo), db=Depends(get_db)):
    p = repo.get(parcel_id)
    if not p:
        raise not_found()
    return series(db, p)


@router.post("/parcels/{parcel_id}/ndvi/refresh", status_code=202)
def request_refresh(parcel_id: str, tasks: BackgroundTasks, repo=Depends(parcel_repo), db=Depends(get_db), c=Depends(container)):
    p = repo.get(parcel_id)
    if not p:
        raise not_found()
    if not p.geometry:
        raise ApiError(422, "falta_contorno", "Dibuja el contorno de tu chacra para leer HLS")
    # Serializar solicitudes por parcela; un trabajo interrumpido puede reintentarse tras 30 minutos.
    db.execute(select(m.Parcel).where(m.Parcel.id == p.id).with_for_update())
    active = db.scalar(select(m.NdviJob).where(m.NdviJob.parcel_id == p.id,
        m.NdviJob.created_at > datetime.now(UTC) - timedelta(minutes=30)))
    if active:
        raise ApiError(429, "hls_reciente", "Espera 30 minutos antes de volver a actualizar esta parcela")
    job = m.NdviJob(owner_id=repo.owner_id, parcel_id=p.id)
    db.add(job)
    db.commit()
    tasks.add_task(refresh, c, job.id, p.geometry, date.today() - timedelta(days=365), date.today())
    return {"job_id": job.id, "status": "pendiente"}


@router.get("/public/ndvi")
def demo_ndvi(zone: str = "majes", db=Depends(get_db)):
    p = db.scalar(select(m.Parcel).where(m.Parcel.is_public_demo.is_(True), m.Parcel.zone_id == zone, m.Parcel.deleted_at.is_(None)))
    if not p:
        raise not_found()
    return series(db, p)
