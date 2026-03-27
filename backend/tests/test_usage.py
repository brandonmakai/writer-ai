"""Tests for per-IP usage tracking."""

from unittest.mock import MagicMock

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


def test_usage_tracker_get_count_returns_zero_for_new_ip() -> None:
    """New IP has count 0."""
    tracker = UsageTracker(":memory:")
    assert tracker.get_count("1.2.3.4") == 0


def test_usage_tracker_increment_and_get_count() -> None:
    """Increment increases count; get_count returns it."""
    tracker = UsageTracker(":memory:")
    tracker.increment("10.0.0.1")
    assert tracker.get_count("10.0.0.1") == 1
    tracker.increment("10.0.0.1")
    assert tracker.get_count("10.0.0.1") == 2


def test_usage_tracker_different_ips_independent() -> None:
    """Different IPs have independent counts."""
    tracker = UsageTracker(":memory:")
    tracker.increment("1.1.1.1")
    tracker.increment("2.2.2.2")
    tracker.increment("1.1.1.1")
    assert tracker.get_count("1.1.1.1") == 2
    assert tracker.get_count("2.2.2.2") == 1


def test_usage_tracker_disabled_never_raises() -> None:
    """When enabled=False, check() never raises regardless of count."""
    tracker = UsageTracker(":memory:", enabled=False)
    for _ in range(10):
        tracker.check("1.2.3.4")


def test_usage_tracker_custom_max_attempts() -> None:
    """UsageTracker respects a custom max_attempts cap."""
    import pytest
    from fastapi import HTTPException

    tracker = UsageTracker(":memory:", max_attempts=2)
    tracker.increment("5.5.5.5")
    tracker.increment("5.5.5.5")
    with pytest.raises(HTTPException) as exc_info:
        tracker.check("5.5.5.5")
    assert exc_info.value.status_code == 429
