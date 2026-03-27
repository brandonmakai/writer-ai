"""FastAPI application factory and wiring."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.chapter import router as chapter_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging


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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")

    return app


app = create_app()
