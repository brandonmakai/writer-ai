"""Shared request/response building blocks for chapter APIs."""

from pydantic import BaseModel, Field

# Common 3–8 structural bullets constraint (outline response, rewrite input)
STRUCTURAL_BULLETS_MIN = 3
STRUCTURAL_BULLETS_MAX = 8


class ChapterBase(BaseModel):
    """Shared chapter text and optional tone/language."""

    chapter_text: str = Field(..., description="Chapter text.")
    tone: str | None = Field(
        default=None,
        description="Optional tone guidance (e.g. darker, lighter, more humorous).",
    )
    language: str | None = Field(
        default=None,
        description="Optional target language (defaults to original).",
    )
