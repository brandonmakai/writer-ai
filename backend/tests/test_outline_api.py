"""Tests for the chapter-to-outline API."""

from fastapi.testclient import TestClient

from app.core.deps import get_outline_service
from app.main import app
from app.schemas.outline import OutlineRequest, OutlineResponse


class MockOutlineService:
    """Returns a fixed outline without calling Gemini."""

    async def outline(self, request: OutlineRequest) -> OutlineResponse:  # noqa: ARG002
        return OutlineResponse(
            bullets=[
                "First structural beat.",
                "Second beat.",
                "Third beat.",
            ]
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
        "First structural beat.",
        "Second beat.",
        "Third beat.",
    ]
    assert len(data["bullets"]) == 3
