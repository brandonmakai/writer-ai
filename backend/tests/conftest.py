"""Shared pytest fixtures for backend tests."""

from collections.abc import Iterator

import pytest

from app.core.deps import get_usage_tracker
from app.core.usage import UsageTracker
from app.main import app


@pytest.fixture(autouse=True)
def fresh_usage_tracker() -> Iterator[None]:
    """Override usage tracker with a fresh in-memory DB per test so tests don't share state."""
    tracker = UsageTracker(redis_url=None)
    app.dependency_overrides[get_usage_tracker] = lambda: tracker
    yield
    app.dependency_overrides.pop(get_usage_tracker, None)
