"""Schemas for the chapter-to-outline (bullets) API."""

from pydantic import BaseModel, Field


class OutlineRequest(BaseModel):
    """Chapter text and optional tone/language for outline extraction."""

    chapter_text: str = Field(..., description="Chapter text to split into structural bullets.")
    tone: str | None = Field(
        default=None,
        description="Optional tone guidance (e.g. darker, lighter, more humorous).",
    )
    language: str | None = Field(
        default=None,
        description="Optional target language for the outline (defaults to original).",
    )


class OutlineResponse(BaseModel):
    """Structural bullets (3–8) derived from the chapter."""

    bullets: list[str] = Field(
        ...,
        min_length=3,
        max_length=8,
        description="Structural bullet points summarizing the chapter.",
    )
