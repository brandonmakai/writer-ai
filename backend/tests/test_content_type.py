"""Tests for the EnforceContentTypeMiddleware CSRF protection."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)

_OUTLINE_URL = "/api/v1/chapter/outline"
_VALID_BODY = b'{"chapter": {"text": "Test chapter."}}'


def test_post_without_content_type_returns_415() -> None:
    response = client.post(
        _OUTLINE_URL,
        content=_VALID_BODY,
        headers={"Content-Type": ""},
    )
    assert response.status_code == 415
    assert response.json()["detail"] == "Content-Type must be application/json"


def test_post_with_form_content_type_returns_415() -> None:
    response = client.post(
        _OUTLINE_URL,
        content=_VALID_BODY,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 415


def test_post_with_multipart_content_type_returns_415() -> None:
    response = client.post(
        _OUTLINE_URL,
        content=_VALID_BODY,
        headers={"Content-Type": "multipart/form-data"},
    )
    assert response.status_code == 415


def test_post_with_text_plain_content_type_returns_415() -> None:
    response = client.post(
        _OUTLINE_URL,
        content=_VALID_BODY,
        headers={"Content-Type": "text/plain"},
    )
    assert response.status_code == 415


def test_post_with_json_content_type_passes_through() -> None:
    """Correct Content-Type is not blocked by middleware (route may still 422/etc)."""
    response = client.post(
        _OUTLINE_URL,
        content=_VALID_BODY,
        headers={"Content-Type": "application/json"},
    )
    # Middleware passed it through — route will 422 (no mock service) or similar,
    # but never 415.
    assert response.status_code != 415


def test_get_request_is_never_blocked() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_post_with_json_charset_passes_through() -> None:
    """Content-Type: application/json; charset=utf-8 must also be accepted."""
    response = client.post(
        _OUTLINE_URL,
        content=_VALID_BODY,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    assert response.status_code != 415
