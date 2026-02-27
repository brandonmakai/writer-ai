"""Schemas for the Rewrite from Outline feature."""

from pydantic import BaseModel, Field

from app.schemas.common import STRUCTURAL_BULLETS_MIN, ChapterBase
from app.schemas.outline import BulletWithAnchor


class RewriteRequest(BaseModel):
    """User-provided chapter context and structural bullets."""

    chapter: ChapterBase = Field(..., description="Chapter text and optional tone/language.")
    bullets: list[str] = Field(
        ...,
        min_length=STRUCTURAL_BULLETS_MIN,
        description="Structural edit bullets (3–8 recommended).",
    )


class SceneSummary(BaseModel):
    summary: str
    characters: list[str]
    purpose: str


class InternalStructure(BaseModel):
    """Structural scaffolding for refactored chapter; bullets include anchor text for tethers."""

    bullets: list[BulletWithAnchor] = Field(
        ...,
        description="Bullets with content and anchor_text verbatim from refactored chapter_text.",
    )
    scene_summaries: list[SceneSummary]


class ChangeHighlight(BaseModel):
    original: str
    updated: str


class RewriteResponse(BaseModel):
    """Structured response mirroring the design in AGENTS.MD."""

    chapter_text: str
    internal_structure: InternalStructure
    change_highlights: list[ChangeHighlight]
