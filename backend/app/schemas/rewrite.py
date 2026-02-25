"""Schemas for the Rewrite from Outline feature."""


from pydantic import BaseModel, Field


class RewriteRequest(BaseModel):
    """User-provided chapter text and structural bullets."""

    chapter_text: str = Field(..., description="Original chapter text to be refactored.")
    bullets: list[str] = Field(
        ...,
        min_length=3,
        description="Structural edit bullets (3–8 recommended).",
    )
    tone: str | None = Field(
        default=None,
        description="Optional tone guidance for the rewrite (e.g. darker, lighter, more humorous).",
    )
    language: str | None = Field(
        default=None,
        description="Optional target language for the rewrite (defaults to original).",
    )


class SceneSummary(BaseModel):
    summary: str
    characters: list[str]
    purpose: str


class InternalStructure(BaseModel):
    bullets: list[str]
    scene_summaries: list[SceneSummary]


class ChangeHighlight(BaseModel):
    original: str
    updated: str


class RewriteResponse(BaseModel):
    """Structured response mirroring the design in AGENTS.MD."""

    chapter_text: str
    internal_structure: InternalStructure
    change_highlights: list[ChangeHighlight]

