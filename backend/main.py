"""Writer AI backend — FastAPI application entrypoint."""

from fastapi import FastAPI

app = FastAPI(
    title="Writer AI API",
    description="Backend for the Rewrite from Outline MVP.",
    version="0.1.0",
)


@app.get("/")
async def read_root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Writer AI backend"}
