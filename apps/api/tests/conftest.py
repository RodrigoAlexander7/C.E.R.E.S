from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pytest

from ceres.config import Settings, get_settings
from ceres.domain.climate import ClimateSeries
from ceres.domain.engine import ClimateInput
from ceres.infrastructure.catalog_loader import load_catalog
from ceres.infrastructure.nasa_power import load_snapshot

TEST_DB = os.environ.get("CERES_TEST_DATABASE_URL", "postgresql+psycopg://ceres:ceres_dev@127.0.0.1:5440/ceres_test")
ORIGIN = "http://testserver"
FIXED_TODAY = date(2026, 11, 14)


@pytest.fixture(scope="session")
def base_settings() -> Settings:
    return get_settings()


@pytest.fixture(scope="session")
def catalog(base_settings):
    return load_catalog(base_settings.data_dir / "catalog" / "catalog.json")


@pytest.fixture(scope="session")
def climate(base_settings) -> ClimateInput:
    """Copia REAL de NASA POWER guardada en data/ (no un fixture sintético)."""
    snap = load_snapshot(base_settings.data_dir / base_settings.nasa_snapshot_file)
    return ClimateInput(snap.snapshot_id, ClimateSeries.from_days(snap.days, snap.query_latitude, snap.cell_elevation_m))


@pytest.fixture(scope="session")
def migrated_db():
    from alembic import command
    from alembic.config import Config

    from sqlalchemy import create_engine, text

    eng = create_engine(TEST_DB)
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"PostgreSQL de pruebas no disponible: {exc}")
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.cmd_opts = type("o", (), {"x": [f"url={TEST_DB}"]})()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    return eng


TABLES = [
    "messages", "conversations", "strategy_assessments", "recommendation_runs", "management_records",
    "soil_observations", "crop_events", "parcel_profile_revisions", "parcels", "sessions",
    "evidence_fragments", "sources", "dataset_snapshots", "users",
]


@pytest.fixture
def make_client(migrated_db, base_settings):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    from ceres.bootstrap import build_container
    from ceres.infrastructure.seed import sync_sources
    from ceres.presentation.app import create_app

    with migrated_db.begin() as conn:
        conn.execute(text("TRUNCATE " + ", ".join(TABLES) + " CASCADE"))

    def factory(llm=None, **overrides):
        settings = base_settings.model_copy(
            update={"database_url": TEST_DB, "app_origin": ORIGIN, "dev_insecure_cookies": True, **overrides}
        )
        c = build_container(settings, llm=llm)
        c.extra["today"] = lambda: FIXED_TODAY
        with c.sessions() as db:
            sync_sources(db, c.sources_file)
            db.commit()
        client = TestClient(create_app(c), base_url=ORIGIN, headers={"Origin": ORIGIN})
        client.container = c
        return client

    return factory


def register(client, email="ana@example.com", password="clave-segura-123"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return r.json()


MAJES_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[-72.1911, -16.3510], [-72.1890, -16.3510], [-72.1890, -16.3490], [-72.1911, -16.3490], [-72.1911, -16.3510]]],
}


def profile(**kw):
    base = {
        "current_crop_id": "maiz_grano",
        "current_status": "en_campo",
        "expected_harvest": "2027-02-15",
        "water": {"mode": "conozco", "allocation_m3": 12000, "efficiency": 0.85, "delivery_point": "toma"},
        "soil": {"ece_ds_m": 0.9, "analysis_date": "2026-06-01", "depth_cm": "0-30", "method": "extracto", "kind": "observado"},
        "priority": "dinero",
        "residue_management": "incorporar",
    }
    base.update(kw)
    return base


def create_parcel(client, **kw):
    r = client.post("/api/v1/parcels", json={"name": "Lote 1", "geometry": MAJES_POLYGON, "profile": profile(**kw)})
    assert r.status_code == 201, r.text
    return r.json()
