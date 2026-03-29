"""FastAPI application factory and wiring."""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.chapter import router as chapter_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import EnforceContentTypeMiddleware

# Reject request bodies larger than 100 KB before they reach route handlers.
# A 2,000-word chapter is ~12 KB; 100 KB gives 8× headroom while still
# preventing payload-stuffing attacks that would waste Gemini quota.
_MAX_BODY_BYTES = 100 * 1024


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

    # 2. CORS — must be registered after TrustedHost so the Host check
    #    runs first. Allows only the configured frontend origin(s).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.add_middleware(EnforceContentTypeMiddleware)

    # 3. Body size guard — return 413 before the router sees oversized payloads.
    @app.middleware("http")
    async def _body_size_guard(request: Request, call_next: object) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _MAX_BODY_BYTES:
            return Response(
                content="Request body too large",
                status_code=413,
            )
        return await call_next(request)  # type: ignore[operator, no-any-return]

    # 4. Security response headers — applied to every response.
    @app.middleware("http")
    async def _security_headers(request: Request, call_next: object) -> Response:
        response: Response = await call_next(request)  # type: ignore[operator]
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

    # --- Routers ---
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")

    return app


app = create_app()
