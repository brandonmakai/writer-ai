"""Tests for request schema validation constraints."""

import pytest
from pydantic import ValidationError

from app.schemas.common import ChapterBase
from app.schemas.edit import EditRequest


def _valid_chapter(**kwargs: object) -> dict[str, object]:
    return {"text": "Short chapter text.", **kwargs}


def test_instruction_max_length_enforced() -> None:
    """instruction longer than 1000 chars is rejected with a ValidationError."""
    with pytest.raises(ValidationError):
        EditRequest(
            chapter=ChapterBase(**_valid_chapter()),
            bullets=["beat one", "beat two", "beat three"],
            instruction="x" * 1001,
        )


def test_instruction_at_max_length_accepted() -> None:
    """instruction exactly 1000 chars is accepted."""
    EditRequest(
        chapter=ChapterBase(**_valid_chapter()),
        bullets=["beat one", "beat two", "beat three"],
        instruction="x" * 1000,
    )


def test_tone_max_length_enforced() -> None:
    """tone longer than 200 chars is rejected with a ValidationError."""
    with pytest.raises(ValidationError):
        ChapterBase(**_valid_chapter(tone="t" * 201))


def test_tone_at_max_length_accepted() -> None:
    """tone exactly 200 chars is accepted."""
    ChapterBase(**_valid_chapter(tone="t" * 200))


def test_language_max_length_enforced() -> None:
    """language longer than 100 chars is rejected with a ValidationError."""
    with pytest.raises(ValidationError):
        ChapterBase(**_valid_chapter(language="l" * 101))


def test_language_at_max_length_accepted() -> None:
    """language exactly 100 chars is accepted."""
    ChapterBase(**_valid_chapter(language="l" * 100))
