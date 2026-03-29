"""Tests for per-IP usage tracking."""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.usage import UsageTracker, get_client_ip


def test_get_client_ip_uses_x_forwarded_for() -> None:
    """Last (platform-appended) IP in X-Forwarded-For is used when present."""
    request = MagicMock()
    request.headers = {"x-forwarded-for": "203.0.113.1, 70.41.3.18"}
    request.client = None
    assert get_client_ip(request) == "70.41.3.18"


def test_get_client_ip_uses_x_forwarded_for_stripped() -> None:
    """Whitespace around the last X-Forwarded-For entry is stripped."""
    request = MagicMock()
    request.headers = {"x-forwarded-for": "  192.168.1.1  , 10.0.0.1"}
    request.client = None
    assert get_client_ip(request) == "10.0.0.1"


def test_get_client_ip_trusts_last_forwarded_for_entry() -> None:
    """Spoofed leading IPs are ignored; the last (platform-appended) IP is returned."""
    request = MagicMock()
    request.headers = {"x-forwarded-for": "1.1.1.1, 2.2.2.2"}
    request.client = None
    assert get_client_ip(request) == "2.2.2.2"


def test_get_client_ip_uses_x_real_ip_when_no_forwarded() -> None:
    """X-Real-IP is used when X-Forwarded-For is absent."""
    request = MagicMock()
    request.headers = {"x-real-ip": "198.51.100.2"}
    request.client = MagicMock(host="127.0.0.1")
    assert get_client_ip(request) == "198.51.100.2"


def test_get_client_ip_uses_request_client_fallback() -> None:
    """request.client.host is used when no proxy headers."""
    request = MagicMock()
    request.headers = {}
    request.client = MagicMock(host="127.0.0.1")
    assert get_client_ip(request) == "127.0.0.1"


def test_get_client_ip_unknown_when_no_client() -> None:
    """Returns 'unknown' when request.client is missing."""
    request = MagicMock()
    request.headers = {}
    request.client = None
    assert get_client_ip(request) == "unknown"


async def test_usage_tracker_get_count_returns_zero_for_new_ip() -> None:
    """New IP has count 0."""
    tracker = UsageTracker(redis_url=None)
    assert await tracker.get_count("1.2.3.4") == 0


async def test_usage_tracker_increment_and_get_count() -> None:
    """Increment increases count; get_count returns it."""
    tracker = UsageTracker(redis_url=None)
    await tracker.increment("10.0.0.1")
    assert await tracker.get_count("10.0.0.1") == 1
    await tracker.increment("10.0.0.1")
    assert await tracker.get_count("10.0.0.1") == 2


async def test_usage_tracker_different_ips_independent() -> None:
    """Different IPs have independent counts."""
    tracker = UsageTracker(redis_url=None)
    await tracker.increment("1.1.1.1")
    await tracker.increment("2.2.2.2")
    await tracker.increment("1.1.1.1")
    assert await tracker.get_count("1.1.1.1") == 2
    assert await tracker.get_count("2.2.2.2") == 1


async def test_usage_tracker_disabled_never_raises() -> None:
    """When enabled=False, check() never raises regardless of count."""
    tracker = UsageTracker(redis_url=None, enabled=False)
    for _ in range(10):
        await tracker.check("1.2.3.4")


async def test_usage_tracker_custom_max_attempts() -> None:
    """UsageTracker respects a custom max_attempts cap."""
    tracker = UsageTracker(redis_url=None, max_attempts=2)
    await tracker.increment("5.5.5.5")
    await tracker.increment("5.5.5.5")
    with pytest.raises(HTTPException) as exc_info:
        await tracker.check("5.5.5.5")
    assert exc_info.value.status_code == 429


# --- Token tracking ---


async def test_token_count_starts_at_zero() -> None:
    """New IP has token count 0."""
    tracker = UsageTracker(redis_url=None)
    assert await tracker.get_token_count("1.2.3.4") == 0


async def test_add_tokens_accumulates() -> None:
    """add_tokens increases count; different IPs are independent."""
    tracker = UsageTracker(redis_url=None)
    await tracker.add_tokens("1.1.1.1", 1000)
    await tracker.add_tokens("1.1.1.1", 500)
    await tracker.add_tokens("2.2.2.2", 200)
    assert await tracker.get_token_count("1.1.1.1") == 1500
    assert await tracker.get_token_count("2.2.2.2") == 200


async def test_check_tokens_raises_when_budget_exhausted() -> None:
    """check_tokens raises 429 once per-IP token budget is reached."""
    tracker = UsageTracker(redis_url=None, max_tokens_per_ip=500)
    await tracker.add_tokens("3.3.3.3", 500)
    with pytest.raises(HTTPException) as exc_info:
        await tracker.check_tokens("3.3.3.3")
    assert exc_info.value.status_code == 429


async def test_check_tokens_passes_when_under_budget() -> None:
    """check_tokens does not raise while under the per-IP token limit."""
    tracker = UsageTracker(redis_url=None, max_tokens_per_ip=1000)
    await tracker.add_tokens("4.4.4.4", 999)
    await tracker.check_tokens("4.4.4.4")  # should not raise


async def test_check_global_tokens_raises_when_exhausted() -> None:
    """check_global_tokens raises 429 once the global budget is consumed."""
    tracker = UsageTracker(redis_url=None, max_tokens_global=1000)
    await tracker.add_tokens("5.5.5.5", 600)
    await tracker.add_tokens("6.6.6.6", 400)
    with pytest.raises(HTTPException) as exc_info:
        await tracker.check_global_tokens()
    assert exc_info.value.status_code == 429


async def test_check_global_tokens_skipped_when_none() -> None:
    """check_global_tokens is a no-op when max_tokens_global is None (default)."""
    tracker = UsageTracker(redis_url=None, max_tokens_global=None)
    # Load up a huge amount — should not raise since global cap is disabled.
    await tracker.add_tokens("7.7.7.7", 10_000_000)
    await tracker.check_global_tokens()  # should not raise


async def test_token_tracking_disabled_when_not_enabled() -> None:
    """When enabled=False, add_tokens is a no-op and checks never raise."""
    tracker = UsageTracker(
        redis_url=None, enabled=False, max_tokens_per_ip=100, max_tokens_global=100
    )
    await tracker.add_tokens("8.8.8.8", 9999)
    await tracker.check_tokens("8.8.8.8")  # should not raise
    await tracker.check_global_tokens()  # should not raise
