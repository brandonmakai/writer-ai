"""FastAPI application factory and wiring."""

from fastapi import FastAPI

from app.api.routes.chapter import router as chapter_router
from app.api.routes.health import router as health_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Writer AI API",
        description="Backend for the Rewrite from Outline MVP.",
        version="0.1.0",
    )

    # Routers
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")

    return app


app = create_app()
