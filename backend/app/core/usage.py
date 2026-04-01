"""Per-IP usage tracking backed by Upstash Redis (production) or in-memory (local dev)."""

from __future__ import annotations

import redis.asyncio as aioredis
from fastapi import HTTPException, Request

_KEY_PREFIX = "writer-ai:ip:"
_TOKEN_KEY_PREFIX = "writer-ai:tokens:ip:"
_GLOBAL_TOKEN_KEY = "writer-ai:tokens:global"
_TTL_SECONDS = 86400  # 24-hour rolling window


def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return (
            forwarded.strip().split(",")[0].strip()
        )  # leftmost = original client IP set by Vercel
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


class UsageTracker:
    """Track and enforce per-IP attempt and token limits.

    Two independent limits defend against LLM cost abuse:
    - Attempt limit: blocks brute-force requests from a single IP.
    - Token limit (per-IP + global): blocks large-payload abuse and VPN-rotation attacks
      that spread load across many IPs.

    Uses Upstash Redis in production (persistent across deploys) and an
    in-memory dict in local dev (no Redis connection required).
    """

    def __init__(
        self,
        redis_url: str | None,
        max_attempts: int = 5,
        enabled: bool = True,
        max_tokens_per_ip: int = 50_000,
        max_tokens_global: int | None = None,
    ) -> None:
        self._max = max_attempts
        self._enabled = enabled
        self._max_tokens_per_ip = max_tokens_per_ip
        self._max_tokens_global = max_tokens_global
        self._redis: aioredis.Redis | None = None
        self._memory: dict[str, int] = {}
        self._memory_tokens: dict[str, int] = {}
        self._memory_global_tokens: int = 0

        if redis_url:
            self._redis = aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
            )

    # --- Attempt tracking ---

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

    # --- Token tracking ---

    def _token_key(self, ip: str) -> str:
        return f"{_TOKEN_KEY_PREFIX}{ip}"

    async def get_token_count(self, ip: str) -> int:
        """Return total LLM tokens consumed by this IP in the current window."""
        if self._redis is not None:
            val = await self._redis.get(self._token_key(ip))
            return int(val) if val else 0
        return self._memory_tokens.get(ip, 0)

    async def check_tokens(self, ip: str) -> None:
        """Raise HTTP 429 if this IP has exhausted its per-IP token budget."""
        if not self._enabled:
            return
        if await self.get_token_count(ip) >= self._max_tokens_per_ip:
            raise HTTPException(
                status_code=429,
                detail=(
                    "You've reached the daily token limit for your IP. Please try again tomorrow."
                ),
            )

    async def check_global_tokens(self) -> None:
        """Raise HTTP 429 if the global token budget for today is exhausted."""
        if not self._enabled or self._max_tokens_global is None:
            return
        if self._redis is not None:
            val = await self._redis.get(_GLOBAL_TOKEN_KEY)
            count = int(val) if val else 0
        else:
            count = self._memory_global_tokens
        if count >= self._max_tokens_global:
            raise HTTPException(
                status_code=429,
                detail="Service is temporarily over capacity. Please try again later.",
            )

    async def add_tokens(self, ip: str, tokens: int) -> None:
        """Record LLM tokens consumed by this IP (called after a successful request)."""
        if not self._enabled or tokens <= 0:
            return
        if self._redis is not None:
            ip_count = await self._redis.incrby(self._token_key(ip), tokens)
            if ip_count == tokens:
                # First write in this window — start the 24-hour TTL
                await self._redis.expire(self._token_key(ip), _TTL_SECONDS)
            global_count = await self._redis.incrby(_GLOBAL_TOKEN_KEY, tokens)
            if global_count == tokens:
                await self._redis.expire(_GLOBAL_TOKEN_KEY, _TTL_SECONDS)
        else:
            self._memory_tokens[ip] = self._memory_tokens.get(ip, 0) + tokens
            self._memory_global_tokens += tokens
