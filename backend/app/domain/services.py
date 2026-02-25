"""Rewrite-from-outline service: delegates to Gemini client."""

from app.clients.gemini import GeminiClient
from app.schemas.rewrite import RewriteRequest, RewriteResponse


class RewriteService:
    """Orchestrates chapter rewrite using the configured LLM client."""

    def __init__(self, client: GeminiClient) -> None:
        self._client = client

    async def rewrite(self, request: RewriteRequest) -> RewriteResponse:
        """Refactor chapter text according to the given structural bullets."""
        return await self._client.rewrite_chapter(request)
