"""Dependencias HTTP: base de datos, sesión, protección CSRF/origen y errores estructurados."""

from __future__ import annotations

import hmac
from collections.abc import Iterator
from dataclasses import dataclass
from urllib.parse import urlparse

from fastapi import Depends, Request
from sqlalchemy.orm import Session as DbSession

from ceres.bootstrap import Container
from ceres.infrastructure.db import models as m
from ceres.infrastructure.db.repositories import ParcelRepo, SessionRepo, UserRepo
from ceres.infrastructure.security import token_hash

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status, self.code, self.message = status, code, message


def not_found() -> ApiError:
    # Misma respuesta para «no existe» y «no es tuyo»: no revela IDs ajenos.
    return ApiError(404, "no_encontrado", "No encontrado")


def container(request: Request) -> Container:
    return request.app.state.container


def get_db(c: Container = Depends(container)) -> Iterator[DbSession]:
    db = c.sessions()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@dataclass
class Auth:
    user: m.User
    session: m.Session

    @property
    def user_id(self) -> str:
        return self.user.id


def _check_origin(request: Request, c: Container) -> None:
    allowed = urlparse(c.settings.app_origin)
    origin = request.headers.get("origin") or request.headers.get("referer")
    if not origin:
        raise ApiError(403, "origen_requerido", "Solicitud sin origen verificable")
    o = urlparse(origin)
    if (o.scheme, o.netloc) != (allowed.scheme, allowed.netloc):
        raise ApiError(403, "origen_no_permitido", "Origen no permitido")


def check_origin(request: Request, c: Container = Depends(container)) -> None:
    if request.method not in SAFE_METHODS:
        _check_origin(request, c)


def optional_auth(request: Request, c: Container = Depends(container), db: DbSession = Depends(get_db)) -> Auth | None:
    token = request.cookies.get(c.settings.session_cookie_name)
    if not token:
        return None
    s = SessionRepo(db).active(token_hash(token))
    if s is None:
        return None
    user = UserRepo(db).get(s.user_id)
    if user is None:
        return None
    if request.method not in SAFE_METHODS:
        _check_origin(request, c)
        sent = request.headers.get("x-csrf-token", "")
        if not sent or not hmac.compare_digest(token_hash(sent), s.csrf_token_hash):
            raise ApiError(403, "csrf_invalido", "Token CSRF ausente o inválido; recarga la página")
    return Auth(user, s)


def require_auth(auth: Auth | None = Depends(optional_auth)) -> Auth:
    if auth is None:
        raise ApiError(401, "sesion_requerida", "Inicia sesión para continuar")
    return auth


def parcel_repo(auth: Auth = Depends(require_auth), db: DbSession = Depends(get_db)) -> ParcelRepo:
    return ParcelRepo(db, auth.user_id)
