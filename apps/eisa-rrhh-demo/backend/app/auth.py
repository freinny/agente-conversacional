import hmac
import secrets
import time
from collections import OrderedDict, deque
from threading import Lock

import bcrypt
from fastapi import HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import Settings

COOKIE_NAME = "__Host-eisa_session"


class RateLimiter:
    def __init__(self, attempts: int, window: int, max_keys: int = 10000):
        self.attempts, self.window, self.max_keys = attempts, window, max_keys
        self.entries = OrderedDict()
        self.lock = Lock()

    def check(self, key: str):
        now = time.monotonic()
        with self.lock:
            values = self.entries.pop(key, deque())
            while values and values[0] <= now - self.window:
                values.popleft()
            self.entries[key] = values
            while len(self.entries) > self.max_keys:
                self.entries.popitem(last=False)
            if len(values) >= self.attempts:
                raise HTTPException(
                    429,
                    "Demasiados intentos; inténtalo más tarde",
                    headers={"Retry-After": str(self.window)},
                )
            values.append(now)


class AuthService:
    """Signed opaque cookie + in-memory active sessions, for a single worker/replica."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.signer = URLSafeTimedSerializer(
            settings.session_secret.get_secret_value(), salt="eisa-session-v1"
        )
        self.sessions = {}
        self.lock = Lock()
        self.login_limiter = RateLimiter(5, 300)
        self.chat_limiter = RateLimiter(20, 60)
        # Validate once at startup, rather than discovering a bad hash on login.
        bcrypt.checkpw(
            b"configuration-check", settings.demo_password_hash.get_secret_value().encode()
        )

    def login(self, username: str, password: str, address: str) -> str:
        self.login_limiter.check(address)
        password_ok = bcrypt.checkpw(
            password.encode(), self.settings.demo_password_hash.get_secret_value().encode()
        )
        user_ok = hmac.compare_digest(username.encode(), self.settings.demo_username.encode())
        if not (password_ok and user_ok):
            raise HTTPException(401, "Credenciales inválidas")
        now = time.time()
        with self.lock:
            self.sessions = {sid: expiry for sid, expiry in self.sessions.items() if expiry > now}
            if len(self.sessions) >= 1000:
                raise HTTPException(429, "Límite de sesiones alcanzado")
            sid = secrets.token_urlsafe(32)
            self.sessions[sid] = now + self.settings.session_ttl_seconds
        return self.signer.dumps(sid)

    def require(self, request: Request) -> str:
        cookie = request.cookies.get(COOKIE_NAME)
        try:
            sid = self.signer.loads(cookie or "", max_age=self.settings.session_ttl_seconds)
        except (BadSignature, SignatureExpired):
            raise HTTPException(401, "Inicia sesión para continuar") from None
        with self.lock:
            expiry = self.sessions.get(sid, 0)
            if expiry <= time.time():
                self.sessions.pop(sid, None)
                raise HTTPException(401, "La sesión ha vencido")
        return sid

    def logout(self, sid: str):
        with self.lock:
            self.sessions.pop(sid, None)
