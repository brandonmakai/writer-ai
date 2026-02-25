"""Schemas for the Rewrite from Outline feature."""

from typing import List, Optional

from pydantic import BaseModel, Field


class RewriteRequest(BaseModel):
    """User-provided chapter text and structural bullets."""

    chapter_text: str = Field(..., description="Original chapter text to be refactored.")
    bullets: List[str] = Field(
        ...,
        min_length=3,
        description="Structural edit bullets (3–8 recommended).",
    )
    tone: Optional[str] = Field(
        default=None,
        description="Optional tone guidance for the rewrite (e.g. darker, lighter, more humorous).",
    )
    language: Optional[str] = Field(
        default=None,
        description="Optional target language for the rewrite (defaults to original).",
    )


class SceneSummary(BaseModel):
    summary: str
    characters: List[str]
    purpose: str


class InternalStructure(BaseModel):
    bullets: List[str]
    scene_summaries: List[SceneSummary]


class ChangeHighlight(BaseModel):
    original: str
    updated: str


class RewriteResponse(BaseModel):
    """Structured response mirroring the design in AGENTS.MD."""

    chapter_text: str
    internal_structure: InternalStructure
    change_highlights: List[ChangeHighlight]

