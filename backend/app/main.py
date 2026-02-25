"""FastAPI application factory and wiring."""

from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.outline import router as outline_router
from app.api.routes.rewrite import router as rewrite_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Writer AI API",
        description="Backend for the Rewrite from Outline MVP.",
        version="0.1.0",
    )

    # Routers
    app.include_router(health_router)
    app.include_router(outline_router, prefix="/api/v1/chapter")
    app.include_router(rewrite_router, prefix="/api/v1/chapter")

    return app


app = create_app()
