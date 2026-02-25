"""Rewrite-from-outline endpoint."""

from fastapi import APIRouter, Depends

from app.core.deps import get_rewrite_service
from app.domain.services import RewriteService
from app.schemas.rewrite import RewriteRequest, RewriteResponse

router = APIRouter(tags=["rewrite"])


@router.post(
    "/rewrite/outline",
    response_model=RewriteResponse,
    summary="Refactor chapter from outline",
    description="Takes chapter text and 3–8 structural bullets; returns refactored chapter with internal structure and change highlights.",
)
async def rewrite_from_outline(
    request: RewriteRequest,
    service: RewriteService = Depends(get_rewrite_service),
) -> RewriteResponse:
    """Refactor the given chapter to match the provided structural bullets."""
    return await service.rewrite(request)
