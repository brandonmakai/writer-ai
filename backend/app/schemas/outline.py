"""Schemas for the chapter-to-outline (bullets) API."""

from pydantic import BaseModel, Field

from app.schemas.common import STRUCTURAL_BULLETS_MAX, STRUCTURAL_BULLETS_MIN, ChapterBase


class OutlineRequest(BaseModel):
    """Request body for outline extraction: has chapter context."""

    chapter: ChapterBase = Field(..., description="Chapter text and optional tone/language.")
    model_config = {"extra": "forbid"}


class BulletWithAnchor(BaseModel):
    """One structural bullet with the verbatim sentence from the chapter it addresses."""

    content: str = Field(..., description="Short summary of the beat or scene.")
    anchor_text: str = Field(
        ...,
        description="Exact verbatim sentence from the chapter that this bullet addresses.",
    )


class OutlineResponse(BaseModel):
    """Structural bullets (3–8) derived from the chapter, each with anchor text."""

    bullets: list[BulletWithAnchor] = Field(
        ...,
        min_length=STRUCTURAL_BULLETS_MIN,
        max_length=STRUCTURAL_BULLETS_MAX,
        description="Structural bullet points, each with content and anchor_text from the chapter.",
    )
