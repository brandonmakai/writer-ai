"""Schemas for the chapter-to-outline (bullets) API."""

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import STRUCTURAL_BULLETS_MAX, STRUCTURAL_BULLETS_MIN, ChapterBase


class OutlineRequest(BaseModel):
    """Request body for outline extraction: has chapter context."""

    chapter: ChapterBase = Field(..., description="Chapter text and optional tone/language.")
    model_config = {"extra": "forbid"}


class BulletWithAnchor(BaseModel):
    """One structural bullet with the verbatim sentence from the chapter it addresses."""

    label: str | None = Field(
        None,
        description="Short title for the beat (e.g. 'Confrontation', 'Turning Point'). Optional.",
    )
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
    suggested_index: int = Field(
        ...,
        ge=0,
        description="0-based index into bullets of the one beat to highlight as suggested edit.",
    )

    @model_validator(mode="after")
    def suggested_index_in_range(self) -> "OutlineResponse":
        if self.suggested_index >= len(self.bullets):
            msg = f"suggested_index must be < len(bullets) ({len(self.bullets)})"
            raise ValueError(msg)
        return self
