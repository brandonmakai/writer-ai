"""Tests for the rewrite-from-outline API."""

from fastapi.testclient import TestClient

from app.core.deps import get_rewrite_service
from app.main import app
from app.schemas.outline import BulletWithAnchor
from app.schemas.rewrite import (
    ChangeHighlight,
    InternalStructure,
    RewriteRequest,
    RewriteResponse,
    SceneSummary,
)


class MockRewriteService:
    """Returns a fixed response without calling Gemini."""

    async def rewrite(self, request: RewriteRequest) -> tuple[RewriteResponse, int]:  # noqa: ARG002
        bullets = [
            BulletWithAnchor(content=b, anchor_text=f"Anchor for: {b[:20]}.")
            for b in request.bullets
        ]
        return RewriteResponse(
            chapter_text="Refactored chapter text.",
            internal_structure=InternalStructure(
                bullets=bullets,
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
        ), 200


def _override_get_rewrite_service() -> MockRewriteService:
    return MockRewriteService()


app.dependency_overrides[get_rewrite_service] = _override_get_rewrite_service

client = TestClient(app)


def test_rewrite_from_outline_returns_200_and_structure() -> None:
    response = client.post(
        "/api/v1/chapter/rewrite",
        json={
            "chapter": {"text": "John met Maria. They argued."},
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
    bullets_data = data["internal_structure"]["bullets"]
    assert len(bullets_data) == 3
    assert bullets_data[0]["content"] == "John meets Maria."
    assert "anchor_text" in bullets_data[0]
    assert bullets_data[1]["content"] == "Tension rises."
    assert bullets_data[2]["content"] == "They argue."
    assert len(data["change_highlights"]) == 1
    assert data["change_highlights"][0]["original"] == "Original."
    assert data["change_highlights"][0]["updated"] == "Updated."


def test_rewrite_returns_502_on_parse_failure() -> None:
    """When the service raises ValueError('Failed to parse Gemini...'), route returns 502."""

    class FailingRewriteService:
        async def rewrite(self, request: RewriteRequest) -> tuple[RewriteResponse, int]:  # noqa: ARG002
            raise ValueError("Failed to parse Gemini response: Unterminated string")

    prev = app.dependency_overrides.get(get_rewrite_service)
    app.dependency_overrides[get_rewrite_service] = lambda: FailingRewriteService()
    try:
        response = client.post(
            "/api/v1/chapter/rewrite",
            json={
                "chapter": {"text": "Some chapter."},
                "bullets": ["Beat one.", "Beat two.", "Beat three."],
            },
        )
        assert response.status_code == 502
        assert response.json()["detail"] == "Rewrite generation failed. Please try again."
    finally:
        if prev is None:
            app.dependency_overrides.pop(get_rewrite_service, None)
        else:
            app.dependency_overrides[get_rewrite_service] = prev
