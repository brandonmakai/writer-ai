"""Chapter endpoints: outline (chapter → bullets) and rewrite (chapter + bullets → refactored)."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_outline_service, get_rewrite_service
from app.domain.services import OutlineService, RewriteService
from app.schemas.outline import OutlineRequest, OutlineResponse
from app.schemas.rewrite import RewriteRequest, RewriteResponse

router = APIRouter(tags=["chapter"])


@router.post(
    "/outline",
    response_model=OutlineResponse,
    summary="Extract structural bullets from chapter",
    description="Chapter text (+ optional tone, language); returns 3–8 bullets.",
)
async def chapter_to_outline(
    request: OutlineRequest,
    service: OutlineService = Depends(get_outline_service),
) -> OutlineResponse:
    """Split the given chapter into 3–8 structural bullet points."""
    try:
        return await service.outline(request)
    except ValueError as e:
        if "Failed to parse Gemini" in str(e):
            raise HTTPException(
                status_code=502,
                detail="Outline generation failed. Please try again.",
            ) from e
        raise


@router.post(
    "/rewrite",
    response_model=RewriteResponse,
    summary="Refactor chapter from outline",
    description="Chapter text + 3–8 bullets; returns refactored chapter and highlights.",
)
async def rewrite_from_outline(
    request: RewriteRequest,
    service: RewriteService = Depends(get_rewrite_service),
) -> RewriteResponse:
    """Refactor the given chapter to match the provided structural bullets."""
    return await service.rewrite(request)
