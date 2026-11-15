"""Hash de contraseñas (Argon2 vía pwdlib), tokens opacos y limitador simple de intentos."""

from __future__ import annotations

import hashlib
import secrets
import time
from collections import defaultdict, deque
from threading import Lock

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

_hasher = PasswordHash((Argon2Hasher(),))
# Hash fijo para igualar el tiempo de respuesta cuando el email no existe.
_DUMMY_HASH = _hasher.hash("ceres-dummy-password-no-user")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _hasher.verify(password, _DUMMY_HASH)
        return False
    return _hasher.verify(password, password_hash)


def new_token() -> str:
    """256 bits de entropía de una fuente criptográfica."""
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RateLimiter:
    """Ventana deslizante en memoria (suficiente para un proceso local de demo)."""

    def __init__(self, max_events: int, window_s: int) -> None:
        self.max_events = max_events
        self.window_s = window_s
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._events[key]
            while q and now - q[0] > self.window_s:
                q.popleft()
            if len(q) >= self.max_events:
                return False
            q.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)
