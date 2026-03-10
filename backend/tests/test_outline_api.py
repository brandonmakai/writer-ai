"""Tests for the chapter-to-outline API."""

from fastapi.testclient import TestClient

from app.core.deps import get_outline_service
from app.main import app
from app.schemas.outline import BulletWithAnchor, OutlineRequest, OutlineResponse


class MockOutlineService:
    """Returns a fixed outline without calling Gemini."""

    async def outline(self, request: OutlineRequest) -> OutlineResponse:  # noqa: ARG002
        return OutlineResponse(
            bullets=[
                BulletWithAnchor(content="First structural beat.", anchor_text="John met Maria."),
                BulletWithAnchor(content="Second beat.", anchor_text="They argued."),
                BulletWithAnchor(content="Third beat.", anchor_text="She left."),
            ],
            suggested_index=1,
        )


def _override_get_outline_service() -> MockOutlineService:
    return MockOutlineService()


app.dependency_overrides[get_outline_service] = _override_get_outline_service

client = TestClient(app)


def test_chapter_to_outline_returns_200_and_bullets() -> None:
    response = client.post(
        "/api/v1/chapter/outline",
        json={"chapter": {"text": "John met Maria. They argued. She left."}},
    )
    assert response.status_code == 200
    data = response.json()
    assert "bullets" in data
    assert data["bullets"] == [
        {"content": "First structural beat.", "anchor_text": "John met Maria."},
        {"content": "Second beat.", "anchor_text": "They argued."},
        {"content": "Third beat.", "anchor_text": "She left."},
    ]
    assert len(data["bullets"]) == 3
    assert data["suggested_index"] == 1


def test_chapter_to_outline_returns_502_on_parse_failure() -> None:
    """When the client raises ValueError('Failed to parse Gemini...'), route returns 502."""

    class FailingOutlineService:
        async def outline(self, request: OutlineRequest) -> OutlineResponse:  # noqa: ARG002
            raise ValueError("Failed to parse Gemini response: Unterminated string")

    prev = app.dependency_overrides.get(get_outline_service)
    app.dependency_overrides[get_outline_service] = lambda: FailingOutlineService()
    try:
        response = client.post(
            "/api/v1/chapter/outline",
            json={"chapter": {"text": "Some chapter."}},
        )
        assert response.status_code == 502
        assert response.json()["detail"] == "Outline generation failed. Please try again."
    finally:
        if prev is None:
            app.dependency_overrides.pop(get_outline_service, None)
        else:
            app.dependency_overrides[get_outline_service] = prev
