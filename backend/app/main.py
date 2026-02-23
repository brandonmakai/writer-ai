"""FastAPI application factory and wiring."""

from fastapi import FastAPI


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Writer AI API",
        description="Backend for the Rewrite from Outline MVP.",
        version="0.1.0",
    )
    return app


app = create_app()

