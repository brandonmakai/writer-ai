"""FastAPI application factory and wiring."""

from fastapi import FastAPI

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

    return app


app = create_app()

