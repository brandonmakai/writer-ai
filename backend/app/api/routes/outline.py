"""Chapter-to-outline (bullets) endpoint."""

from fastapi import APIRouter, Depends

from app.core.deps import get_outline_service
from app.domain.services import OutlineService
from app.schemas.outline import OutlineRequest, OutlineResponse

router = APIRouter(tags=["outline"])


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
    return await service.outline(request)
