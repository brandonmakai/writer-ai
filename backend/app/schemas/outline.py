"""Schemas for the chapter-to-outline (bullets) API."""

from pydantic import BaseModel, Field

from app.schemas.common import STRUCTURAL_BULLETS_MAX, STRUCTURAL_BULLETS_MIN, ChapterBase


class OutlineRequest(BaseModel):
    """Request body for outline extraction: has chapter context."""

    chapter: ChapterBase = Field(..., description="Chapter text and optional tone/language.")
    model_config = {"extra": "forbid"}


class OutlineResponse(BaseModel):
    """Structural bullets (3–8) derived from the chapter."""

    bullets: list[str] = Field(
        ...,
        min_length=STRUCTURAL_BULLETS_MIN,
        max_length=STRUCTURAL_BULLETS_MAX,
        description="Structural bullet points summarizing the chapter.",
    )
