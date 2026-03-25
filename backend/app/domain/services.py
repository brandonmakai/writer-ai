"""Chapter services: outline extraction, rewrite, and micro-edit (delegate to Gemini client)."""

from app.clients.gemini import GeminiClient
from app.schemas.edit import EditRequest, EditResponse
from app.schemas.outline import OutlineRequest, OutlineResponse
from app.schemas.rewrite import RewriteRequest, RewriteResponse


class OutlineService:
    """Orchestrates chapter-to-bullets using the configured LLM client."""

    def __init__(self, client: GeminiClient) -> None:
        self._client = client

    async def outline(self, request: OutlineRequest) -> OutlineResponse:
        """Split chapter text into 3–8 structural bullets."""
        return await self._client.outline_chapter(request)


class RewriteService:
    """Orchestrates chapter rewrite using the configured LLM client."""

    def __init__(self, client: GeminiClient) -> None:
        self._client = client

    async def rewrite(self, request: RewriteRequest) -> RewriteResponse:
        """Refactor chapter text according to the given structural bullets."""
        return await self._client.rewrite_chapter(request)


class EditService:
    """Orchestrates targeted micro-edits using the configured LLM client."""

    def __init__(self, client: GeminiClient) -> None:
        self._client = client

    async def edit(self, request: EditRequest) -> EditResponse:
        """Apply a targeted edit instruction to the chapter via search-replace pairs."""
        return await self._client.edit_chapter(request)
