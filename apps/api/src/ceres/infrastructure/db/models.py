"""Modelo persistente (SQLAlchemy 2). Propietarios, fechas y FK como columnas; estructuras variables en JSONB."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Identity,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

JSONType = JSON().with_variant(JSONB(), "postgresql")


def new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    active_parcel_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf_token_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Parcel(Base):
    __tablename__ = "parcels"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    geometry: Mapped[dict | None] = mapped_column(JSONType, nullable=True)  # GeoJSON Polygon
    point: Mapped[dict | None] = mapped_column(JSONType, nullable=True)  # {"lat","lon"} referencia
    area_ha: Mapped[float] = mapped_column(Float)
    area_origin: Mapped[str] = mapped_column(String(20))  # geodesica | declarada
    region_codes: Mapped[dict] = mapped_column(JSONType, default=dict)  # códigos texto + proveedor
    in_pilot_zone: Mapped[bool] = mapped_column(Boolean, default=False)
    zone_id: Mapped[str | None] = mapped_column(String(30), nullable=True)  # zona piloto (data/zonas/)
    active_revision_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_public_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (CheckConstraint("area_ha > 0", name="ck_parcel_area_positive"),)


class ParcelProfileRevision(Base):
    __tablename__ = "parcel_profile_revisions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    # Perfil completo versionado: cultivo actual, agua, suelo, costos, prioridad, procedencia por campo.
    data: Mapped[dict] = mapped_column(JSONType)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CropEvent(Base):
    __tablename__ = "crop_events"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    crop_id: Mapped[str] = mapped_column(String(40))
    variety: Mapped[str | None] = mapped_column(String(120), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sowing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_harvest: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_harvest: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20))  # en_campo | cosechado
    area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    origin: Mapped[str] = mapped_column(String(20), default="declarado")
    supersedes_id: Mapped[str | None] = mapped_column(String(32), nullable=True)  # corrección trazable
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SoilObservation(Base):
    __tablename__ = "soil_observations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sampled_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    depth_cm: Mapped[str | None] = mapped_column(String(20), nullable=True)
    method: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lab: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # {"ece": {"value": 1.2, "unit": "dS/m"}, ...}; ausente ≠ 0
    parameters: Mapped[dict] = mapped_column(JSONType)
    origin: Mapped[str] = mapped_column(String(20))  # observado | declarado | supuesto_demo
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ManagementRecord(Base):
    __tablename__ = "management_records"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30))  # abono | fertilizante | residuos | otro
    description: Mapped[str] = mapped_column(String(300))
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    composition: Mapped[str | None] = mapped_column(String(200), nullable=True)
    applied_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    cost_soles: Mapped[float | None] = mapped_column(Float, nullable=True)
    origin: Mapped[str] = mapped_column(String(20), default="declarado")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SourceRecord(Base):
    __tablename__ = "sources"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    institution: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(300))
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    section: Mapped[str | None] = mapped_column(String(300), nullable=True)
    scope: Mapped[str | None] = mapped_column(String(300), nullable=True)
    kind: Mapped[str] = mapped_column(String(40))
    status: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    registry_version: Mapped[str] = mapped_column(String(60))


class EvidenceFragment(Base):
    __tablename__ = "evidence_fragments"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    registry_version: Mapped[str] = mapped_column(String(60))
    # Índice FTS (to_tsvector('spanish', title || text)) creado en la migración inicial.


class DatasetSnapshot(Base):
    __tablename__ = "dataset_snapshots"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    provider: Mapped[str] = mapped_column(String(60))
    sha256: Mapped[str] = mapped_column(String(64))
    file_path: Mapped[str] = mapped_column(String(300))
    summary: Mapped[dict] = mapped_column(JSONType)
    loaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecommendationRun(Base):
    __tablename__ = "recommendation_runs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
    revision_id: Mapped[str] = mapped_column(ForeignKey("parcel_profile_revisions.id"))
    inputs: Mapped[dict] = mapped_column(JSONType)  # entradas congeladas (incluye escenario)
    scenario_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    engine_version: Mapped[str] = mapped_column(String(40))
    catalog_version: Mapped[str] = mapped_column(String(60))
    dataset_snapshot_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    dataset_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[dict] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    assessments: Mapped[list["StrategyAssessmentRow"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class StrategyAssessmentRow(Base):
    __tablename__ = "strategy_assessments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("recommendation_runs.id", ondelete="CASCADE"), index=True)
    strategy_id: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(30))
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data: Mapped[dict] = mapped_column(JSONType)
    run: Mapped[RecommendationRun] = relationship(back_populates="assessments")


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("recommendation_runs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    # Orden estable dentro de una misma transacción (now() es igual para pregunta y respuesta).
    seq: Mapped[int] = mapped_column(BigInteger, Identity(), unique=True)
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)  # fuentes, métricas, faltantes, estado del proveedor
    provider_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NdviObservation(Base):
    __tablename__ = "ndvi_observations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id"), index=True)
    scene_id: Mapped[str] = mapped_column(String(100))
    observed_on: Mapped[date] = mapped_column(Date)
    data: Mapped[dict] = mapped_column(JSONType)
    geometry_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NdviJob(Base):
    __tablename__ = "ndvi_jobs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pendiente")
    detail: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FieldRecord(Base):
    """Registro tipado del cuaderno: campaña, venta, costo, ganancia o agenda."""
    __tablename__ = "field_records"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    data: Mapped[dict] = mapped_column(JSONType)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    origin: Mapped[str] = mapped_column(String(40), default="declarado")
    message_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FieldRevision(Base):
    __tablename__ = "field_revisions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    record_id: Mapped[str] = mapped_column(ForeignKey("field_records.id"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSONType)
    origin: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecordProposal(Base):
    __tablename__ = "record_proposals"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parcel_id: Mapped[str] = mapped_column(ForeignKey("parcels.id"), index=True)
    data: Mapped[dict] = mapped_column(JSONType)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="pendiente")
    result_ids: Mapped[list] = mapped_column(JSONType, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
