"""Chapter endpoints: outline (chapter → bullets) and rewrite (chapter + bullets → refactored)."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.deps import (
    UsageTracker,
    get_outline_service,
    get_rewrite_service,
    get_usage_tracker,
)
from app.core.usage import get_client_ip
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
    http_request: Request,
    request: OutlineRequest,
    response: Response,
    service: OutlineService = Depends(get_outline_service),
    tracker: UsageTracker = Depends(get_usage_tracker),
) -> OutlineResponse:
    """Split the given chapter into 3–8 structural bullet points."""
    ip = get_client_ip(http_request)
    tracker.check(ip)
    try:
        result = await service.outline(request)
    except ValueError as e:
        if "Failed to parse Gemini" in str(e):
            raise HTTPException(
                status_code=502,
                detail="Outline generation failed. Please try again.",
            ) from e
        raise
    tracker.increment(ip)
    response.headers["X-Remaining-Attempts"] = str(tracker.remaining(ip))
    return result


@router.post(
    "/rewrite",
    response_model=RewriteResponse,
    summary="Refactor chapter from outline",
    description="Chapter text + 3–8 bullets; returns refactored chapter and highlights.",
)
async def rewrite_from_outline(
    http_request: Request,
    request: RewriteRequest,
    response: Response,
    service: RewriteService = Depends(get_rewrite_service),
    tracker: UsageTracker = Depends(get_usage_tracker),
) -> RewriteResponse:
    """Refactor the given chapter to match the provided structural bullets."""
    ip = get_client_ip(http_request)
    tracker.check(ip)
    result = await service.rewrite(request)
    tracker.increment(ip)
    response.headers["X-Remaining-Attempts"] = str(tracker.remaining(ip))
    return result
