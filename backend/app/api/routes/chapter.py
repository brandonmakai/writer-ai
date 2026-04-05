"""Chapter endpoints: outline, rewrite, and micro-edit."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.deps import (
    UsageTracker,
    get_edit_service,
    get_outline_service,
    get_rewrite_service,
    get_usage_tracker,
)
from app.core.usage import get_client_ip
from app.domain.services import EditService, OutlineService, RewriteService
from app.schemas.edit import EditRequest, EditResponse
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
    await tracker.check(ip)
    await tracker.check_tokens(ip)
    await tracker.check_global_tokens()
    try:
        result, tokens = await service.outline(request)
    except ValueError as e:
        if "Failed to parse Gemini" in str(e):
            raise HTTPException(
                status_code=502,
                detail="Outline generation failed. Please try again.",
            ) from e
        raise
    await tracker.increment(ip)
    await tracker.add_tokens(ip, tokens)
    response.headers["X-Remaining-Attempts"] = str(await tracker.remaining(ip))
    response.headers["X-Tokens-Used"] = str(tokens)
    reset_in = await tracker.reset_in(ip)
    if reset_in is not None:
        response.headers["X-Reset-In"] = str(reset_in)
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
    await tracker.check(ip)
    await tracker.check_tokens(ip)
    await tracker.check_global_tokens()
    try:
        result, tokens = await service.rewrite(request)
    except ValueError as e:
        if "Failed to parse Gemini" in str(e):
            raise HTTPException(
                status_code=502,
                detail="Rewrite generation failed. Please try again.",
            ) from e
        raise
    await tracker.increment(ip)
    await tracker.add_tokens(ip, tokens)
    response.headers["X-Remaining-Attempts"] = str(await tracker.remaining(ip))
    response.headers["X-Tokens-Used"] = str(tokens)
    reset_in = await tracker.reset_in(ip)
    if reset_in is not None:
        response.headers["X-Reset-In"] = str(reset_in)
    return result


@router.post(
    "/edit",
    response_model=EditResponse,
    summary="Micro-edit chapter via search-replace",
    description="Chapter text + bullets + instruction; returns edited chapter with highlights.",
)
async def edit_chapter(
    http_request: Request,
    request: EditRequest,
    response: Response,
    service: EditService = Depends(get_edit_service),
    tracker: UsageTracker = Depends(get_usage_tracker),
) -> EditResponse:
    """Apply a targeted edit instruction to the chapter text."""
    ip = get_client_ip(http_request)
    await tracker.check(ip)
    await tracker.check_tokens(ip)
    await tracker.check_global_tokens()
    try:
        result, tokens = await service.edit(request)
    except ValueError as e:
        if "Failed to parse Gemini" in str(e):
            raise HTTPException(
                status_code=502,
                detail="Edit generation failed. Please try again.",
            ) from e
        raise
    await tracker.increment(ip)
    await tracker.add_tokens(ip, tokens)
    response.headers["X-Remaining-Attempts"] = str(await tracker.remaining(ip))
    response.headers["X-Tokens-Used"] = str(tokens)
    reset_in = await tracker.reset_in(ip)
    if reset_in is not None:
        response.headers["X-Reset-In"] = str(reset_in)
    return result
