"""Autenticación, sesiones revocables, CSRF/origen y aislamiento entre cuentas (PostgreSQL real)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from ceres.infrastructure.db import models as m
from tests.conftest import ORIGIN, create_parcel, register

pytestmark = pytest.mark.db


def test_writes_are_committed_before_success_headers(make_client):
    c = make_client()
    observed = []

    class CommitProbe:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            async def capture(message):
                if message["type"] == "http.response.start" and message["status"] == 201:
                    with c.container.sessions() as db:
                        table = m.User if scope["path"].endswith("/auth/register") else m.Parcel
                        observed.append(db.scalar(select(table.id).limit(1)) is not None)
                await send(message)
            await self.app(scope, receive, capture)

    c.app.add_middleware(CommitProbe)
    register(c)
    create_parcel(c)
    assert observed == [True, True]


def test_register_login_logout_revokes_session(make_client):
    c = make_client()
    register(c)
    assert c.get("/api/v1/me").status_code == 200
    old_cookie = c.cookies.get("ceres_session")
    assert c.post("/api/v1/auth/logout").status_code == 200
    assert c.get("/api/v1/me").status_code == 401
    c.cookies.set("ceres_session", old_cookie)  # reutilizar la cookie revocada
    assert c.get("/api/v1/me").status_code == 401
    r = c.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "clave-segura-123"})
    assert r.status_code == 200
    set_cookie = r.headers.get_list("set-cookie")
    sess = next(h for h in set_cookie if h.startswith("ceres_session="))
    assert "HttpOnly" in sess and "SameSite=lax" in sess


def test_password_stored_as_argon2(make_client):
    c = make_client()
    register(c)
    with c.container.sessions() as db:
        u = db.scalar(select(m.User))
        assert u.password_hash.startswith("$argon2") and "clave-segura-123" not in u.password_hash
        s = db.scalar(select(m.Session))
        assert c.cookies.get("ceres_session") not in s.token_hash  # solo se guarda el hash


def test_secure_cookie_outside_dev(make_client):
    c = make_client(dev_insecure_cookies=False)
    r = c.post("/api/v1/auth/register", json={"email": "x@example.com", "password": "clave-segura-123"})
    assert "Secure" in next(h for h in r.headers.get_list("set-cookie") if h.startswith("ceres_session="))


def test_expired_session(make_client):
    c = make_client()
    register(c)
    with c.container.sessions() as db:
        db.scalar(select(m.Session)).expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()
    assert c.get("/api/v1/me").status_code == 401


def test_wrong_credentials_and_rate_limit(make_client):
    c = make_client(login_max_attempts=3)
    register(c)
    for _ in range(3):
        assert c.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "incorrecta-123"}).status_code == 401
    assert c.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": "clave-segura-123"}).status_code == 429


def test_csrf_and_origin_required_for_mutations(make_client):
    c = make_client()
    register(c)
    token = c.headers.pop("X-CSRF-Token")
    body = {"name": "x", "point": {"lat": -16.35, "lon": -72.19}, "area_ha": 2, "profile": {"current_crop_id": "maiz_grano", "current_status": "cosechado"}}
    assert c.post("/api/v1/parcels", json=body).json()["error"]["code"] == "csrf_invalido"
    c.headers["X-CSRF-Token"] = token
    r = c.post("/api/v1/parcels", json=body, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "origen_no_permitido"
    assert c.post("/api/v1/parcels", json=body).status_code == 201


def test_two_accounts_are_isolated(make_client):
    a = make_client()
    register(a, "ana@example.com")
    parcel = create_parcel(a)
    run = a.post(f"/api/v1/parcels/{parcel['id']}/recommendations", json={}).json()
    conv = a.post(f"/api/v1/parcels/{parcel['id']}/conversations", json={"run_id": run["id"]}).json()

    b = make_client()
    register(b, "beto@example.com")
    pid, rid, cid = parcel["id"], run["id"], conv["id"]
    assert b.get("/api/v1/parcels").json()["items"] == []
    for path in (f"/api/v1/parcels/{pid}", f"/api/v1/parcels/{pid}/profile-revisions", f"/api/v1/parcels/{pid}/crop-events",
                 f"/api/v1/parcels/{pid}/recommendations", f"/api/v1/recommendations/{rid}", f"/api/v1/conversations/{cid}",
                 f"/api/v1/parcels/{pid}/conversations", f"/api/v1/recommendations/{rid}/reproduce"):
        r = b.get(path)
        assert r.status_code == 404, path
        assert r.json()["error"]["code"] == "no_encontrado"  # no revela si existe
    assert b.patch(f"/api/v1/parcels/{pid}", json={"name": "robada"}).status_code == 404
    assert b.delete(f"/api/v1/parcels/{pid}").status_code == 404
    assert b.post(f"/api/v1/parcels/{pid}/recommendations", json={}).status_code == 404
    assert b.post(f"/api/v1/conversations/{cid}/messages", json={"question": "¿qué sembró Ana?"}).status_code == 404
    # B no puede vincular el run de A a su propia parcela
    pb = create_parcel(b)
    assert b.post(f"/api/v1/parcels/{pb['id']}/conversations", json={"run_id": rid}).status_code == 404
    # A sigue viendo lo suyo intacto
    assert a.get(f"/api/v1/parcels/{pid}").json()["name"] == "Lote 1"


def test_private_responses_not_cacheable(make_client):
    c = make_client()
    register(c)
    r = c.get("/api/v1/parcels")
    assert r.headers["cache-control"] == "no-store"


def test_anonymous_cannot_create_private_data(make_client):
    c = make_client()
    r = c.post("/api/v1/parcels", json={"point": {"lat": -16.35, "lon": -72.19}, "area_ha": 2, "profile": {"current_crop_id": "maiz_grano", "current_status": "cosechado"}})
    assert r.status_code == 401
    assert c.get("/api/v1/regions").status_code == 200  # el mapa público no requiere cuenta
    assert c.get("/api/v1/sources").status_code == 200
