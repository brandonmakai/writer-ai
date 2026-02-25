"""Healthcheck endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Simple healthcheck endpoint."""
    return {"status": "ok"}
