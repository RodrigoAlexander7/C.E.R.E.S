"""Repositorio SQL del cuaderno: propietario, revisiones y control de concurrencia."""
from datetime import UTC, datetime
from sqlalchemy import select
from ceres.domain.notebook import RecordInput
from ceres.infrastructure.db import models as m
from ceres.application.errors import ApiError


def not_found():
    return ApiError(404, "no_encontrado", "No encontrado")


def records(db, owner, parcel):
    return [serialize(r) for r in db.scalars(select(m.FieldRecord).where(m.FieldRecord.owner_id == owner,
        m.FieldRecord.parcel_id == parcel, m.FieldRecord.deleted_at.is_(None)).order_by(m.FieldRecord.created_at.desc()))]


def serialize(r):
    return {"id": r.id, "parcel_id": r.parcel_id, "data": r.data, "revision": r.revision,
            "origin": r.origin, "created_at": r.created_at.isoformat() if r.created_at else None}


def owned(db, owner, parcel, record_id, lock=False):
    q = select(m.FieldRecord).where(m.FieldRecord.id == record_id, m.FieldRecord.owner_id == owner,
        m.FieldRecord.parcel_id == parcel, m.FieldRecord.deleted_at.is_(None))
    r = db.scalar(q.with_for_update() if lock else q)
    if not r: raise not_found()
    return r


def save(db, owner, parcel, body: RecordInput, zone, record_id=None, origin="declarado", message_id=None):
    data = body.data.model_dump(mode="json")
    if zone and data["kind"] == "campana" and data["crop_id"] not in {*zone.catalog.crops, *zone.catalog.non_catalog_crops}:
        raise ApiError(422, "cultivo", "Elige un cultivo de la zona")
    if data.get("evidence") == "simulado_demo":
        origin = "supuesto_demo"
    if data.get("campaign_id"):
        campaign = owned(db, owner, parcel, data["campaign_id"])
        if campaign.kind != "campana": raise ApiError(422, "campana", "Ese registro no es una campaña")
    if record_id:
        r = owned(db, owner, parcel, record_id, lock=True)
        if body.revision != r.revision: raise ApiError(409, "revision", "El registro cambió; vuelve a abrirlo antes de editar")
        if r.kind != data["kind"]: raise ApiError(422, "tipo", "No se puede cambiar el tipo de registro")
        r.revision += 1
        r.data, r.origin, r.message_id = data, origin, message_id
    else:
        r = m.FieldRecord(owner_id=owner, parcel_id=parcel, kind=data["kind"], data=data, origin=origin, message_id=message_id)
        db.add(r); db.flush()
    db.add(m.FieldRevision(record_id=r.id, owner_id=owner, revision=r.revision,
                           data=data, origin=origin))
    db.flush()
    return r


def delete(db, owner, parcel, record_id, revision):
    r = owned(db, owner, parcel, record_id, lock=True)
    if r.revision != revision: raise ApiError(409, "revision", "El registro cambió")
    # Evitar que una campaña borrada deje ventas/costos económicamente huérfanos.
    if r.kind == "campana" and any(x["data"].get("campaign_id") == r.id for x in records(db, owner, parcel)):
        raise ApiError(409, "vinculos", "Esta campaña tiene ventas o gastos; corrige esos registros primero")
    r.deleted_at = datetime.now(UTC); r.revision += 1
    db.add(m.FieldRevision(record_id=r.id, owner_id=owner, revision=r.revision,
                           data={"deleted": True, "previous": r.data}, origin="declarado"))
