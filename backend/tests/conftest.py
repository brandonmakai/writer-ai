"""Shared pytest fixtures for backend tests."""

from collections.abc import Iterator

import pytest

from app.core.deps import get_usage_store
from app.core.usage import UsageStore
from app.main import app


@pytest.fixture(autouse=True)
def fresh_usage_store() -> Iterator[None]:
    """Override usage store with a fresh in-memory DB per test so tests don't share state."""
    store = UsageStore(":memory:")
    app.dependency_overrides[get_usage_store] = lambda: store
    yield
    app.dependency_overrides.pop(get_usage_store, None)
