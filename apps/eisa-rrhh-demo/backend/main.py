import logging
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.auth import COOKIE_NAME, AuthService
from app.config import Settings
from app.models.contracts import ChatRequest, ChatResponse, LoginRequest
from app.services.chat_service import QUESTIONS, ChatService
from app.services.foundry_client import FoundryNL2SQLClient, ModelResponseError, ModelUnavailable
from app.services.sql_guardrails import SQLRejected
from app.services.sqlite_executor import QueryExecutionError, SQLiteExecutor


def create_app(settings: Settings | None = None, model=None) -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = settings or Settings()
    app = FastAPI(title="EISA · Data Assistant", docs_url=None, redoc_url=None, openapi_url=None)
    auth = AuthService(settings)
    executor = SQLiteExecutor(settings.database_path)
    chat = ChatService(model or FoundryNL2SQLClient(settings), executor)
    app.state.auth = auth
    app.state.chat = chat
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=[urlsplit(settings.public_origin).hostname]
    )

    @app.middleware("http")
    async def security(request: Request, call_next):
        if (
            request.method in {"POST", "PUT", "PATCH", "DELETE"}
            and request.headers.get("origin") != settings.public_origin
        ):
            response = JSONResponse({"detail": "Origen no autorizado"}, status_code=403)
        elif (
            request.method == "POST"
            and request.headers.get("content-type", "").split(";")[0] != "application/json"
        ):
            response = JSONResponse({"detail": "Usa application/json"}, status_code=415)
        else:
            # Count actual bytes as well as Content-Length, including chunked bodies.
            body_size = 0
            too_large = False
            chunks = []
            if request.method == "POST":
                async for chunk in request.stream():
                    body_size += len(chunk)
                    if body_size > 8192:
                        too_large = True
                        break
                    chunks.append(chunk)
                if not too_large:
                    request._body = b"".join(chunks)
            if too_large:
                response = JSONResponse({"detail": "Solicitud demasiado grande"}, status_code=413)
            else:
                response = await call_next(request)
        response.headers.update(
            {
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "no-referrer",
                "Strict-Transport-Security": "max-age=31536000",
                "Cache-Control": "no-store",
                "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            }
        )
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        # Pydantic errors normally include input values (including passwords).
        return JSONResponse(
            {"detail": "Entrada inválida; revisa los campos y el límite de 500 caracteres"},
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def unexpected(request, error):
        logging.getLogger("eisa").error("Unexpected application error: %s", type(error).__name__)
        return JSONResponse({"detail": "Error interno; inténtalo más tarde"}, status_code=500)

    @app.get("/healthz")
    def health():
        return {"status": "ok"}

    @app.get("/readyz")
    def ready():
        try:
            executor.latest_period()
            if not settings.model_configured():
                raise ModelUnavailable()
        except (QueryExecutionError, ModelUnavailable):
            return JSONResponse({"status": "not_ready"}, status_code=503)
        return {"status": "ready"}

    @app.post("/api/auth/login")
    def login(payload: LoginRequest, request: Request, response: Response):
        old_cookie = request.cookies.get(COOKIE_NAME)
        if old_cookie:
            try:
                auth.logout(auth.require(request))
            except HTTPException:
                pass
        cookie = auth.login(
            payload.username, payload.password, request.client.host if request.client else "unknown"
        )
        response.set_cookie(
            COOKIE_NAME,
            cookie,
            max_age=settings.session_ttl_seconds,
            secure=True,
            httponly=True,
            samesite="strict",
            path="/",
        )
        return {"username": settings.demo_username}

    @app.get("/api/auth/me")
    def me(sid=Depends(auth.require)):
        return {"username": settings.demo_username}

    @app.post("/api/auth/logout")
    def logout(response: Response, sid=Depends(auth.require)):
        auth.logout(sid)
        response.delete_cookie(COOKIE_NAME, secure=True, httponly=True, samesite="strict", path="/")
        return {"status": "logged_out"}

    @app.get("/api/demo/questions")
    def questions(sid=Depends(auth.require)):
        return {"questions": QUESTIONS[:1]}

    @app.post("/api/chat", response_model=ChatResponse)
    def answer(payload: ChatRequest, sid=Depends(auth.require)):
        auth.chat_limiter.check(sid)
        try:
            return chat.answer(payload.message)
        except SQLRejected:
            raise HTTPException(
                422, "SQL rechazado por los controles de seguridad; reformula la pregunta"
            ) from None
        except ModelResponseError as error:
            raise HTTPException(422, str(error)) from None
        except ModelUnavailable as error:
            raise HTTPException(503, str(error)) from None
        except QueryExecutionError:
            raise HTTPException(
                422, "La consulta no pudo completarse dentro de los límites permitidos"
            ) from None

    # Match unknown API paths before the static mount, which is only for web files.
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def missing_api(path: str):
        raise HTTPException(404, "Ruta no encontrada")

    if settings.static_path.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_path, html=True), name="web")
    return app


# uvicorn main:create_app --factory avoids startup config evaluation during tests.
