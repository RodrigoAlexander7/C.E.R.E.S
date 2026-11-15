"""Repositorios SQLAlchemy. Toda lectura/escritura privada filtra por propietario ANTES de devolver datos."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session as DbSession

from ceres.infrastructure.db import models as m


def utcnow() -> datetime:
    return datetime.now(UTC)


class UserRepo:
    def __init__(self, db: DbSession) -> None:
        self.db = db

    def by_email(self, email: str) -> m.User | None:
        return self.db.scalar(select(m.User).where(m.User.email == email))

    def get(self, user_id: str) -> m.User | None:
        return self.db.get(m.User, user_id)

    def create(self, email: str, password_hash: str) -> m.User:
        u = m.User(email=email, password_hash=password_hash)
        self.db.add(u)
        self.db.flush()
        return u


class SessionRepo:
    def __init__(self, db: DbSession) -> None:
        self.db = db

    def create(self, user_id: str, token_hash: str, csrf_hash: str, ttl_hours: int) -> m.Session:
        s = m.Session(user_id=user_id, token_hash=token_hash, csrf_token_hash=csrf_hash, expires_at=utcnow() + timedelta(hours=ttl_hours))
        self.db.add(s)
        self.db.flush()
        return s

    def active(self, token_hash: str) -> m.Session | None:
        s = self.db.scalar(select(m.Session).where(m.Session.token_hash == token_hash))
        if s is None or s.revoked_at is not None or s.expires_at <= utcnow():
            return None
        return s

    def revoke(self, s: m.Session) -> None:
        s.revoked_at = utcnow()


class ParcelRepo:
    """Acceso a parcelas y datos dependientes, siempre acotado a `owner_id`."""

    def __init__(self, db: DbSession, owner_id: str) -> None:
        self.db = db
        self.owner_id = owner_id

    def list(self) -> list[m.Parcel]:
        return list(
            self.db.scalars(
                select(m.Parcel).where(m.Parcel.owner_id == self.owner_id, m.Parcel.deleted_at.is_(None)).order_by(m.Parcel.created_at)
            )
        )

    def get(self, parcel_id: str) -> m.Parcel | None:
        return self.db.scalar(
            select(m.Parcel).where(m.Parcel.id == parcel_id, m.Parcel.owner_id == self.owner_id, m.Parcel.deleted_at.is_(None))
        )

    def add(self, parcel: m.Parcel) -> m.Parcel:
        parcel.owner_id = self.owner_id
        self.db.add(parcel)
        self.db.flush()
        return parcel

    def soft_delete(self, parcel: m.Parcel) -> None:
        parcel.deleted_at = utcnow()

    # revisiones
    def revisions(self, parcel_id: str) -> list[m.ParcelProfileRevision]:
        return list(
            self.db.scalars(
                select(m.ParcelProfileRevision)
                .where(m.ParcelProfileRevision.parcel_id == parcel_id, m.ParcelProfileRevision.owner_id == self.owner_id)
                .order_by(m.ParcelProfileRevision.number.desc())
            )
        )

    def revision(self, revision_id: str) -> m.ParcelProfileRevision | None:
        return self.db.scalar(
            select(m.ParcelProfileRevision).where(m.ParcelProfileRevision.id == revision_id, m.ParcelProfileRevision.owner_id == self.owner_id)
        )

    def add_revision(self, parcel: m.Parcel, data: dict, note: str | None) -> m.ParcelProfileRevision:
        n = self.db.scalar(select(func.coalesce(func.max(m.ParcelProfileRevision.number), 0)).where(m.ParcelProfileRevision.parcel_id == parcel.id)) or 0
        rev = m.ParcelProfileRevision(parcel_id=parcel.id, owner_id=self.owner_id, number=n + 1, data=data, note=note)
        self.db.add(rev)
        self.db.flush()
        parcel.active_revision_id = rev.id
        return rev

    # eventos
    def crop_events(self, parcel_id: str) -> list[m.CropEvent]:
        return list(
            self.db.scalars(
                select(m.CropEvent).where(m.CropEvent.parcel_id == parcel_id, m.CropEvent.owner_id == self.owner_id).order_by(m.CropEvent.created_at.desc())
            )
        )

    def add_event(self, ev: m.CropEvent) -> m.CropEvent:
        ev.owner_id = self.owner_id
        self.db.add(ev)
        self.db.flush()
        return ev

    def soil(self, parcel_id: str) -> list[m.SoilObservation]:
        return list(
            self.db.scalars(
                select(m.SoilObservation).where(m.SoilObservation.parcel_id == parcel_id, m.SoilObservation.owner_id == self.owner_id).order_by(m.SoilObservation.created_at.desc())
            )
        )

    def add_soil(self, obs: m.SoilObservation) -> m.SoilObservation:
        obs.owner_id = self.owner_id
        self.db.add(obs)
        self.db.flush()
        return obs

    def management(self, parcel_id: str) -> list[m.ManagementRecord]:
        return list(
            self.db.scalars(
                select(m.ManagementRecord).where(m.ManagementRecord.parcel_id == parcel_id, m.ManagementRecord.owner_id == self.owner_id).order_by(m.ManagementRecord.created_at.desc())
            )
        )

    def add_management(self, rec: m.ManagementRecord) -> m.ManagementRecord:
        rec.owner_id = self.owner_id
        self.db.add(rec)
        self.db.flush()
        return rec

    # resultados
    def add_run(self, run: m.RecommendationRun) -> m.RecommendationRun:
        run.owner_id = self.owner_id
        self.db.add(run)
        self.db.flush()
        return run

    def runs(self, parcel_id: str) -> list[m.RecommendationRun]:
        return list(
            self.db.scalars(
                select(m.RecommendationRun)
                .where(m.RecommendationRun.parcel_id == parcel_id, m.RecommendationRun.owner_id == self.owner_id)
                .order_by(m.RecommendationRun.created_at.desc())
            )
        )

    def run(self, run_id: str) -> m.RecommendationRun | None:
        return self.db.scalar(
            select(m.RecommendationRun)
            .join(m.Parcel, m.Parcel.id == m.RecommendationRun.parcel_id)
            .where(m.RecommendationRun.id == run_id, m.RecommendationRun.owner_id == self.owner_id, m.Parcel.deleted_at.is_(None))
        )

    # conversaciones
    def add_conversation(self, conv: m.Conversation) -> m.Conversation:
        conv.owner_id = self.owner_id
        self.db.add(conv)
        self.db.flush()
        return conv

    def conversation(self, conv_id: str) -> m.Conversation | None:
        return self.db.scalar(select(m.Conversation).where(m.Conversation.id == conv_id, m.Conversation.owner_id == self.owner_id))

    def conversations(self, parcel_id: str) -> list[m.Conversation]:
        return list(
            self.db.scalars(
                select(m.Conversation).where(m.Conversation.parcel_id == parcel_id, m.Conversation.owner_id == self.owner_id).order_by(m.Conversation.created_at.desc())
            )
        )

    def messages(self, conv_id: str) -> list[m.Message]:
        conv = self.conversation(conv_id)
        if conv is None:
            return []
        return list(self.db.scalars(select(m.Message).where(m.Message.conversation_id == conv.id).order_by(m.Message.seq)))

    def add_message(self, msg: m.Message) -> m.Message:
        if self.conversation(msg.conversation_id) is None:
            raise PermissionError("conversación ajena")
        self.db.add(msg)
        self.db.flush()
        return msg


class PublicRepo:
    """Datos públicos: fuentes, fichas, instantáneas y el caso de demostración."""

    def __init__(self, db: DbSession) -> None:
        self.db = db

    def sources(self, owner_id: str | None = None) -> dict[str, dict]:
        q = select(m.SourceRecord).where(or_(m.SourceRecord.is_public.is_(True), m.SourceRecord.owner_id == owner_id) if owner_id else m.SourceRecord.is_public.is_(True))
        return {s.id: _source_dict(s) for s in self.db.scalars(q)}

    def source(self, source_id: str, owner_id: str | None) -> dict | None:
        s = self.db.get(m.SourceRecord, source_id)
        if s is None or (not s.is_public and s.owner_id != owner_id):
            return None
        d = _source_dict(s)
        d["fragments"] = [
            {"id": f.id, "title": f.title, "text": f.text}
            for f in self.db.scalars(select(m.EvidenceFragment).where(m.EvidenceFragment.source_id == s.id).order_by(m.EvidenceFragment.id))
            if f.is_public or f.owner_id == owner_id
        ]
        return d

    def search_fragments(self, query: str, owner_id: str | None, limit: int = 5) -> list[dict]:
        """FTS en español sobre fichas públicas y las propias del usuario."""
        rows = self.db.execute(
            text(
                """
                SELECT id, source_id, title, text,
                       ts_rank(to_tsvector('spanish', title || ' ' || text), q) AS rank
                FROM evidence_fragments, websearch_to_tsquery('spanish', :q) q
                WHERE (is_public OR owner_id = :owner)
                  AND to_tsvector('spanish', title || ' ' || text) @@ q
                ORDER BY rank DESC, id
                LIMIT :limit
                """
            ),
            {"q": _or_query(query), "owner": owner_id, "limit": limit},
        ).mappings()
        return [dict(r) for r in rows]

    def fragments_by_ids(self, ids: list[str]) -> list[dict]:
        if not ids:
            return []
        rows = self.db.scalars(select(m.EvidenceFragment).where(m.EvidenceFragment.id.in_(ids), m.EvidenceFragment.is_public.is_(True)))
        return [{"id": f.id, "source_id": f.source_id, "title": f.title, "text": f.text} for f in rows]

    def demo_parcel(self, zone_id: str) -> m.Parcel | None:
        return self.db.scalar(
            select(m.Parcel).where(m.Parcel.is_public_demo.is_(True), m.Parcel.zone_id == zone_id, m.Parcel.deleted_at.is_(None))
        )

    def latest_run(self, parcel_id: str) -> m.RecommendationRun | None:
        return self.db.scalar(
            select(m.RecommendationRun).where(m.RecommendationRun.parcel_id == parcel_id).order_by(m.RecommendationRun.created_at.desc()).limit(1)
        )

    def snapshot(self, snapshot_id: str) -> m.DatasetSnapshot | None:
        return self.db.get(m.DatasetSnapshot, snapshot_id)


STOPWORDS = {"que", "qué", "por", "para", "con", "los", "las", "una", "uno", "del", "como", "cómo", "mi", "me", "el", "la", "de", "en", "y", "a", "es", "se", "si", "sí", "lo", "al", "mas", "más"}


def _or_query(q: str) -> str:
    words = [w for w in "".join(c if c.isalnum() else " " for c in q.lower()).split() if len(w) > 2 and w not in STOPWORDS]
    return " or ".join(words[:12]) or "agua"


def _source_dict(s: m.SourceRecord) -> dict:
    return {
        "id": s.id,
        "institution": s.institution,
        "title": s.title,
        "url": s.url,
        "section": s.section,
        "scope": s.scope,
        "kind": s.kind,
        "status": s.status,
        "is_public": s.is_public,
        "registry_version": s.registry_version,
    }
