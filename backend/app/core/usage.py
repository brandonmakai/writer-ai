"""Per-IP usage tracking backed by Upstash Redis (production) or in-memory (local dev)."""

from __future__ import annotations

import redis.asyncio as aioredis
from fastapi import HTTPException, Request

_KEY_PREFIX = "writer-ai:ip:"
_TTL_SECONDS = 86400  # 24-hour rolling window


def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.strip().split(",")[-1].strip()  # rightmost = platform-trusted
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


class UsageTracker:
    """Track and enforce per-IP attempt limits.

    Uses Upstash Redis in production (persistent across deploys) and an
    in-memory dict in local dev (no Redis connection required).
    """

    def __init__(
        self,
        redis_url: str | None,
        max_attempts: int = 5,
        enabled: bool = True,
    ) -> None:
        self._max = max_attempts
        self._enabled = enabled
        self._redis: aioredis.Redis | None = None
        self._memory: dict[str, int] = {}

        if redis_url:
            self._redis = aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )

    def _key(self, ip: str) -> str:
        return f"{_KEY_PREFIX}{ip}"

    async def get_count(self, ip: str) -> int:
        """Return the current attempt count for the given IP."""
        if self._redis is not None:
            val = await self._redis.get(self._key(ip))
            return int(val) if val else 0
        return self._memory.get(ip, 0)

    async def check(self, ip: str) -> None:
        """Raise HTTP 429 if this IP has reached the attempt limit."""
        if not self._enabled:
            return
        if await self.get_count(ip) >= self._max:
            raise HTTPException(
                status_code=429,
                detail=f"You've used all {self._max} free attempts. Please try again later.",
            )

    async def increment(self, ip: str) -> None:
        """Record one attempt for the given IP."""
        if not self._enabled:
            return
        if self._redis is not None:
            count = await self._redis.incr(self._key(ip))
            if count == 1:
                # First use — start the 24-hour window
                await self._redis.expire(self._key(ip), _TTL_SECONDS)
        else:
            self._memory[ip] = self._memory.get(ip, 0) + 1

    async def remaining(self, ip: str) -> int:
        """Return how many attempts remain for the given IP."""
        return max(0, self._max - await self.get_count(ip))
