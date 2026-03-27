"""Schemas for the micro-edit (search-replace) API."""

from pydantic import BaseModel, Field

from app.schemas.common import STRUCTURAL_BULLETS_MIN, ChapterBase
from app.schemas.outline import BulletWithAnchor
from app.schemas.rewrite import ChangeHighlight, InternalStructure


class EditRequest(BaseModel):
    """Request body for a targeted chapter edit."""

    chapter: ChapterBase = Field(..., description="Chapter text and optional tone/language.")
    bullets: list[str] = Field(
        ...,
        min_length=STRUCTURAL_BULLETS_MIN,
        description="Current structural bullets (3–8) for the chapter.",
    )
    instruction: str = Field(
        ...,
        max_length=1000,
        description="Plain-language edit instruction from the user.",
    )


class SearchReplacePair(BaseModel):
    """One exact search-replace operation returned by the LLM."""

    search: str = Field(
        ...,
        description="Exact substring from the original chapter to find (copy-paste precision).",
    )
    replace: str = Field(..., description="Replacement text for the matched substring.")


class LLMEditPayload(BaseModel):
    """Raw payload returned by the LLM for a micro-edit request."""

    edits: list[SearchReplacePair] = Field(
        ...,
        description="Ordered search-replace pairs to apply to the chapter.",
    )
    bullets: list[BulletWithAnchor] = Field(
        ...,
        description="Updated structural bullets reflecting the edited chapter.",
    )


class EditResponse(BaseModel):
    """Response returned to the client after applying micro-edits."""

    chapter_text: str = Field(..., description="Chapter text after all edits have been applied.")
    change_highlights: list[ChangeHighlight] = Field(
        ...,
        description="Original/updated pairs for each successfully applied edit.",
    )
    internal_structure: InternalStructure = Field(
        ...,
        description="Updated structural bullets with anchor_text from the edited chapter.",
    )
    edits_applied: int = Field(
        ...,
        ge=0,
        description="Number of search-replace pairs that were successfully found and applied.",
    )
