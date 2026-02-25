"""Tests for the rewrite-from-outline API."""

from fastapi.testclient import TestClient

from app.core.deps import get_rewrite_service
from app.main import app
from app.schemas.rewrite import (
    ChangeHighlight,
    InternalStructure,
    RewriteResponse,
    SceneSummary,
)


class MockRewriteService:
    """Returns a fixed response without calling Gemini."""

    async def rewrite(self, request):  # noqa: ARG002
        return RewriteResponse(
            chapter_text="Refactored chapter text.",
            internal_structure=InternalStructure(
                bullets=request.bullets,
                scene_summaries=[
                    SceneSummary(
                        summary="Summary.",
                        characters=["Character"],
                        purpose="Establish scene.",
                    )
                ],
            ),
            change_highlights=[
                ChangeHighlight(original="Original.", updated="Updated."),
            ],
        )


def _override_get_rewrite_service():
    return MockRewriteService()


app.dependency_overrides[get_rewrite_service] = _override_get_rewrite_service

client = TestClient(app)


def test_rewrite_from_outline_returns_200_and_structure() -> None:
    response = client.post(
        "/api/v1/rewrite/outline",
        json={
            "chapter_text": "John met Maria. They argued.",
            "bullets": [
                "John meets Maria.",
                "Tension rises.",
                "They argue.",
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["chapter_text"] == "Refactored chapter text."
    assert "internal_structure" in data
    assert data["internal_structure"]["bullets"] == [
        "John meets Maria.",
        "Tension rises.",
        "They argue.",
    ]
    assert len(data["change_highlights"]) == 1
    assert data["change_highlights"][0]["original"] == "Original."
    assert data["change_highlights"][0]["updated"] == "Updated."
