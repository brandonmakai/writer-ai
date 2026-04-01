"""FastAPI application factory and wiring."""

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.routes.chapter import router as chapter_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import EnforceContentTypeMiddleware

# Reject request bodies larger than 100 KB before they reach route handlers.
# A 2,000-word chapter is ~12 KB; 100 KB gives 8× headroom while still
# preventing payload-stuffing attacks that would waste Gemini quota.
_MAX_BODY_BYTES = 100 * 1024


class _BodySizeGuard:
    """Reject oversized request bodies before they reach route handlers.

    Pure ASGI middleware — avoids BaseHTTPMiddleware's ExceptionGroup wrapping
    so route-handler exceptions propagate cleanly to FastAPI's error handler.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            content_length = headers.get(b"content-length")
            if content_length and int(content_length) > _MAX_BODY_BYTES:
                response = Response("Request body too large", status_code=413)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


class _SecurityHeaders:
    """Add security response headers to every HTTP response.

    Pure ASGI middleware — avoids BaseHTTPMiddleware's ExceptionGroup wrapping
    so route-handler exceptions propagate cleanly to FastAPI's error handler.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                headers["Cache-Control"] = "no-store"
            await send(message)

        await self.app(scope, receive, send_with_headers)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    configure_logging()

    settings = get_settings()
    app = FastAPI(
        title="Writer AI API",
        description="Backend for the Rewrite from Outline MVP.",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # --- Middleware (applied in reverse registration order by Starlette) ---

    # 1. Trusted host guard — reject requests with unexpected Host headers.
    #    Prevents Host header injection and direct-to-Railway attacks that
    #    bypass Cloudflare. In local dev, allowed_hosts defaults to ["*"].
    if settings.allowed_hosts != ["*"]:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts,
        )

    # 2. CORS — must be registered after TrustedHost so the Host check runs first.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # 3. Content-type enforcement, body size guard, security headers.
    app.add_middleware(EnforceContentTypeMiddleware)
    app.add_middleware(_BodySizeGuard)
    app.add_middleware(_SecurityHeaders)

    # --- Routers ---
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")

    return app


app = create_app()
