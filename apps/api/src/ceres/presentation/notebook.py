from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends
from sqlalchemy import select
from ceres.infrastructure.db.notebook import records, save, delete, serialize, owned
from ceres.domain.notebook import RecordInput, summary
from ceres.infrastructure.db import models as m
from ceres.presentation.deps import ApiError, container, get_db, not_found, parcel_repo

router = APIRouter(prefix="/api/v1/parcels/{parcel_id}")


@router.get("/notebook")
def read_book(parcel_id: str, repo=Depends(parcel_repo), db=Depends(get_db)):
    if not repo.get(parcel_id): raise not_found()
    items = records(db, repo.owner_id, parcel_id)
    return {"items": items, **summary(items, datetime.now(ZoneInfo("America/Lima")).date())}


@router.post("/notebook", status_code=201)
def add_record(parcel_id: str, body: RecordInput, repo=Depends(parcel_repo), db=Depends(get_db), c=Depends(container)):
    p = repo.get(parcel_id)
    if not p: raise not_found()
    zone = c.zone(p.zone_id) if p.zone_id else None
    return serialize(save(db, repo.owner_id, p.id, body, zone))


@router.put("/notebook/{record_id}")
def update_record(parcel_id: str, record_id: str, body: RecordInput, repo=Depends(parcel_repo), db=Depends(get_db), c=Depends(container)):
    p = repo.get(parcel_id)
    if not p: raise not_found()
    zone = c.zone(p.zone_id) if p.zone_id else None
    return serialize(save(db, repo.owner_id, p.id, body, zone, record_id))


@router.delete("/notebook/{record_id}")
def remove_record(parcel_id: str, record_id: str, revision: int, repo=Depends(parcel_repo), db=Depends(get_db)):
    if not repo.get(parcel_id): raise not_found()
    delete(db, repo.owner_id, parcel_id, record_id, revision)
    return {"ok": True}


@router.get("/notebook/{record_id}/history")
def history(parcel_id: str, record_id: str, repo=Depends(parcel_repo), db=Depends(get_db)):
    if not repo.get(parcel_id): raise not_found()
    # Incluso el historial necesita autorización del registro y de su parcela.
    r = db.scalar(select(m.FieldRecord).where(m.FieldRecord.id == record_id,
        m.FieldRecord.owner_id == repo.owner_id, m.FieldRecord.parcel_id == parcel_id))
    if not r: raise not_found()
    return {"items": [{"revision": x.revision, "data": x.data, "origin": x.origin,
        "created_at": x.created_at.isoformat()} for x in db.scalars(select(m.FieldRevision).where(
        m.FieldRevision.record_id == record_id, m.FieldRevision.owner_id == repo.owner_id).order_by(m.FieldRevision.revision))]}
