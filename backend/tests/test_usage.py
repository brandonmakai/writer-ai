"""Tests for per-IP usage tracking."""

from unittest.mock import MagicMock

from app.core.usage import UsageStore, get_client_ip


def test_get_client_ip_uses_x_forwarded_for() -> None:
    """First IP in X-Forwarded-For is used when present."""
    request = MagicMock()
    request.headers = {"x-forwarded-for": "203.0.113.1, 70.41.3.18"}
    request.client = None
    assert get_client_ip(request) == "203.0.113.1"


def test_get_client_ip_uses_x_forwarded_for_stripped() -> None:
    """Whitespace around X-Forwarded-For is stripped."""
    request = MagicMock()
    request.headers = {"x-forwarded-for": "  192.168.1.1  , 10.0.0.1"}
    request.client = None
    assert get_client_ip(request) == "192.168.1.1"


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


def test_usage_store_get_count_returns_zero_for_new_ip() -> None:
    """New IP has used_count 0."""
    store = UsageStore(":memory:")
    assert store.get_count("1.2.3.4") == 0


def test_usage_store_increment_and_get_count() -> None:
    """Increment increases count; get_count returns it."""
    store = UsageStore(":memory:")
    store.increment("10.0.0.1")
    assert store.get_count("10.0.0.1") == 1
    store.increment("10.0.0.1")
    assert store.get_count("10.0.0.1") == 2


def test_usage_store_different_ips_independent() -> None:
    """Different IPs have independent counts."""
    store = UsageStore(":memory:")
    store.increment("1.1.1.1")
    store.increment("2.2.2.2")
    store.increment("1.1.1.1")
    assert store.get_count("1.1.1.1") == 2
    assert store.get_count("2.2.2.2") == 1
