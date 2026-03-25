"""Shared request/response building blocks for chapter APIs."""

from pydantic import BaseModel, Field, field_validator

STRUCTURAL_BULLETS_MIN = 3
STRUCTURAL_BULLETS_MAX = 8

# Hard cap on chapter length for MVP (protects LLM and UX).
# TODO: Remove post-launch in favor of chapter segmentation.
MAX_CHAPTER_WORDS = 2500


class ChapterBase(BaseModel):
    """Shared chapter text and optional tone/language."""

    text: str = Field(..., description="Chapter text.")
    tone: str | None = Field(
        default=None,
        description="Optional tone guidance (e.g. darker, lighter, more humorous).",
    )
    language: str | None = Field(
        default=None,
        description="Optional target language (defaults to original).",
    )

    @field_validator("text")
    @classmethod
    def validate_length(cls, value: str) -> str:
        """Reject chapters that exceed the hard word cap for this MVP."""
        words = len(value.split())
        if words > MAX_CHAPTER_WORDS:
            msg = (
                f"Chapter is too long for this preview. "
                f"Paste a single chapter under {MAX_CHAPTER_WORDS} words."
            )
            raise ValueError(msg)
        return value
