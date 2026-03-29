"""Tests for the chapter-to-outline API."""

from fastapi.testclient import TestClient

from app.core.deps import get_outline_service
from app.main import app
from app.schemas.outline import BulletWithAnchor, OutlineRequest, OutlineResponse


class MockOutlineService:
    """Returns a fixed outline without calling Gemini."""

    async def outline(self, request: OutlineRequest) -> tuple[OutlineResponse, int]:  # noqa: ARG002
        return OutlineResponse(
            bullets=[
                BulletWithAnchor(content="First structural beat.", anchor_text="John met Maria."),
                BulletWithAnchor(content="Second beat.", anchor_text="They argued."),
                BulletWithAnchor(content="Third beat.", anchor_text="She left."),
            ],
            suggested_index=1,
        ), 100


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
        {"label": None, "content": "First structural beat.", "anchor_text": "John met Maria."},
        {"label": None, "content": "Second beat.", "anchor_text": "They argued."},
        {"label": None, "content": "Third beat.", "anchor_text": "She left."},
    ]
    assert len(data["bullets"]) == 3
    assert data["suggested_index"] == 1


def test_chapter_to_outline_returns_502_on_parse_failure() -> None:
    """When the client raises ValueError('Failed to parse Gemini...'), route returns 502."""

    class FailingOutlineService:
        async def outline(self, request: OutlineRequest) -> tuple[OutlineResponse, int]:  # noqa: ARG002
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


def test_chapter_to_outline_returns_429_after_5_attempts() -> None:
    """Sixth successful outline request from same IP returns 429."""
    for _ in range(5):
        resp = client.post(
            "/api/v1/chapter/outline",
            json={"chapter": {"text": "Some chapter."}},
        )
        assert resp.status_code == 200, resp.text
    resp6 = client.post(
        "/api/v1/chapter/outline",
        json={"chapter": {"text": "Another chapter."}},
    )
    assert resp6.status_code == 429
    assert "5 free attempts" in resp6.json()["detail"]


def test_chapter_to_outline_does_not_increment_on_502() -> None:
    """A 502 parse failure does not consume a credit; user can still get 5 successes."""

    class FailingOnceOutlineService:
        call_count = 0

        async def outline(self, request: OutlineRequest) -> tuple[OutlineResponse, int]:  # noqa: ARG002
            FailingOnceOutlineService.call_count += 1
            if FailingOnceOutlineService.call_count == 1:
                raise ValueError("Failed to parse Gemini response: bad json")
            return OutlineResponse(
                bullets=[
                    BulletWithAnchor(content="Beat one.", anchor_text="Text one."),
                    BulletWithAnchor(content="Beat two.", anchor_text="Text two."),
                    BulletWithAnchor(content="Beat three.", anchor_text="Text three."),
                ],
                suggested_index=0,
            ), 100

    prev_svc = app.dependency_overrides.get(get_outline_service)
    app.dependency_overrides[get_outline_service] = lambda: FailingOnceOutlineService()
    try:
        resp_fail = client.post(
            "/api/v1/chapter/outline",
            json={"chapter": {"text": "Chapter."}},
        )
        assert resp_fail.status_code == 502
        for _ in range(5):
            resp = client.post(
                "/api/v1/chapter/outline",
                json={"chapter": {"text": "Chapter."}},
            )
            assert resp.status_code == 200, resp.text
        resp_429 = client.post(
            "/api/v1/chapter/outline",
            json={"chapter": {"text": "Chapter."}},
        )
        assert resp_429.status_code == 429
    finally:
        if prev_svc is None:
            app.dependency_overrides.pop(get_outline_service, None)
        else:
            app.dependency_overrides[get_outline_service] = prev_svc
