# Agent 1 — Backend Launch Hardening

**You are**: an autonomous coding agent (Claude). Your task is to implement all backend code changes required for production launch.

**Your worktree**: You are working in a git worktree on branch `feature/backend-launch-hardening`. Your working directory contains the full monorepo. All your changes must be within the `backend/` directory.

**Do not touch**: Anything in `frontend/`, `docs/`, or repo root. The frontend agent (Agent 2) owns those files and is working in a separate worktree simultaneously.

**Coordinate via interface contract**: Agent 2 (frontend) is changing `frontend/lib/api.ts` so all API calls go to `/api/v1/...` (same-origin, no host prefix). Your backend does not need to change its route structure — the existing `/api/v1/chapter/...` paths remain identical.

---

## Worktree Setup (run before starting)

```bash
# From the repo root, in your terminal:
git worktree add -b feature/backend-launch-hardening ../writer-ai-backend main
cd ../writer-ai-backend/backend
```

All commands below assume you are in `../writer-ai-backend/backend/`.

---

## Overview of Changes

| File | Change |
|---|---|
| `pyproject.toml` | Add `redis[asyncio]>=5.0` dependency |
| `app/core/config.py` | Add `upstash_redis_url` and `allowed_hosts` settings fields |
| `app/core/usage.py` | Replace SQLite with async Redis + in-memory fallback |
| `app/api/routes/chapter.py` | Add `await` to all three tracker calls per endpoint |
| `app/main.py` | Add TrustedHostMiddleware, body size guard, security response headers |
| `railway.toml` | Create deployment config (new file) |

Run tests after each file change: `uv run pytest`

---

## Task 1 — Add Redis Dependency

**File**: `backend/pyproject.toml`

Find the `dependencies` array and add `redis[asyncio]`:

```toml
dependencies = [
    "fastapi[standard]>=0.132.0",
    "httpx>=0.28.1",
    "pydantic-settings>=2.13.1",
    "redis[asyncio]>=5.0",
    "uvicorn[standard]>=0.41.0",
]
```

After editing, run:
```bash
uv lock
uv sync
```

This regenerates `uv.lock` with the redis package pinned.

---

## Task 2 — Add Config Fields

**File**: `backend/app/core/config.py`

Current state of the file (full):
```python
"""Application configuration and settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = Field(default="local", description="Application environment name.")
    debug: bool = Field(default=False, description="Enable debug mode.")
    log_level: str = Field(default="INFO", description="Root log level.")

    gemini_api_key: str | None = Field(default=None, ...)
    gemini_model: str = Field(default="gemini-2.5-flash", ...)
    gemini_model_fast: str = Field(default="gemini-2.5-flash-lite", ...)
    gemini_structured_output: bool = Field(default=True, ...)

    cors_origins: list[str] = Field(default_factory=list, ...)

    limit_usage_per_ip: bool = Field(default=True, ...)
    max_attempts_per_ip: int = Field(default=5, ...)
    usage_db_path: str = Field(default="data/usage.db", ...)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
```

Add two new fields after `usage_db_path`:

```python
    upstash_redis_url: str | None = Field(
        default=None,
        description=(
            "Redis connection URL for per-IP usage tracking. "
            "Use a rediss:// URL from Upstash. "
            "If None and env is 'local', falls back to in-memory tracking."
        ),
    )
    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["*"],
        description=(
            "Hosts accepted by TrustedHostMiddleware. "
            "In production set to your Vercel domain and Railway custom domain. "
            "Default '*' allows all hosts in local dev."
        ),
    )
```

Keep `usage_db_path` in place — it is still read in tests that use `:memory:`. Do not remove it.

---

## Task 3 — Replace SQLite with Async Redis

**File**: `backend/app/core/usage.py`

This is a full replacement of the file. The public interface (`check`, `increment`, `remaining`, `get_client_ip`) is preserved exactly — no callers need to change their import statements.

The key behavioral changes:
- All three tracker methods become `async` (callers in `chapter.py` must `await` them — handled in Task 4)
- If `redis_url` is provided, use Redis for persistence (survives Railway redeploys)
- If `redis_url` is `None` (local dev), fall back to an in-memory `dict` (no SQLite required to run locally)
- Redis key format: `writer-ai:ip:{ip_address}` → integer count
- TTL: 86400 seconds (24 hours from first request). Resets the daily window automatically.

Write the file as follows:

```python
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
        self._redis: aioredis.Redis | None = None  # type: ignore[type-arg]
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
```

**Important**: The old `__init__` accepted `db_path` and `enabled`. The new one accepts `redis_url` and `enabled`. The `deps.py` file must be updated in Task 5 to pass the correct argument.

---

## Task 4 — Await Tracker Calls in Route Handlers

**File**: `backend/app/api/routes/chapter.py`

The tracker methods are now `async`. Every `tracker.check(ip)`, `tracker.increment(ip)`, and `tracker.remaining(ip)` call must be prefixed with `await`.

There are 3 endpoints in this file, each with the same pattern. Make these 3 changes:

**In `chapter_to_outline`**:
```python
# Before:
tracker.check(ip)
# ...
tracker.increment(ip)
response.headers["X-Remaining-Attempts"] = str(tracker.remaining(ip))

# After:
await tracker.check(ip)
# ...
await tracker.increment(ip)
response.headers["X-Remaining-Attempts"] = str(await tracker.remaining(ip))
```

**In `rewrite_from_outline`**: apply the same three substitutions.

**In `edit_chapter`**: apply the same three substitutions.

No other changes to this file. All 3 endpoint functions are already `async def` — no function signature changes needed.

---

## Task 5 — Update deps.py to Use Redis URL

**File**: `backend/app/core/deps.py`

Find the `_usage_tracker()` function:

```python
@lru_cache(maxsize=1)
def _usage_tracker() -> UsageTracker:
    s = get_settings()
    return UsageTracker(
        db_path=s.usage_db_path,
        max_attempts=s.max_attempts_per_ip,
        enabled=s.limit_usage_per_ip,
    )
```

Replace it with:

```python
@lru_cache(maxsize=1)
def _usage_tracker() -> UsageTracker:
    s = get_settings()
    return UsageTracker(
        redis_url=s.upstash_redis_url,
        max_attempts=s.max_attempts_per_ip,
        enabled=s.limit_usage_per_ip,
    )
```

The only change: `db_path=s.usage_db_path` → `redis_url=s.upstash_redis_url`.

---

## Task 6 — Harden main.py

**File**: `backend/app/main.py`

Current state (full):
```python
"""FastAPI application factory and wiring."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.chapter import router as chapter_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    app = FastAPI(
        title="Writer AI API",
        description="Backend for the Rewrite from Outline MVP.",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")
    return app


app = create_app()
```

Replace with the following. Three additions: TrustedHostMiddleware, a body-size guard middleware, and security response headers middleware.

```python
"""FastAPI application factory and wiring."""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes.chapter import router as chapter_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging

# Reject request bodies larger than 100 KB before they reach route handlers.
# A 2,000-word chapter is ~12 KB; 100 KB gives 8× headroom while still
# preventing payload-stuffing attacks that would waste Gemini quota.
_MAX_BODY_BYTES = 100 * 1024


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(
        title="Writer AI API",
        description="Backend for the Rewrite from Outline MVP.",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # --- Middleware (applied in reverse registration order by Starlette) ---

    # 1. Trusted host guard — reject requests with unexpected Host headers.
    #    Prevents Host header injection and direct-to-Railway attacks that
    #    bypass Cloudflare. In local dev, allowed_hosts defaults to ["*"].
    if settings.allowed_hosts != ["*"]:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts,
        )

    # 2. CORS — must be registered after TrustedHost so the Host check
    #    runs first. Allows only the configured frontend origin(s).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # 3. Body size guard — return 413 before the router sees oversized payloads.
    @app.middleware("http")
    async def _body_size_guard(request: Request, call_next: object) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _MAX_BODY_BYTES:
            return Response(
                content="Request body too large",
                status_code=413,
            )
        return await call_next(request)  # type: ignore[operator]

    # 4. Security response headers — applied to every response.
    @app.middleware("http")
    async def _security_headers(request: Request, call_next: object) -> Response:
        response: Response = await call_next(request)  # type: ignore[operator]
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

    # --- Routers ---
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")

    return app


app = create_app()
```

---

## Task 7 — Create Railway Deployment Config

**File**: `backend/railway.toml` (new file, create at repo path `backend/railway.toml`)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1"
healthcheckPath = "/health"
healthcheckTimeout = 10
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

Notes on the flags:
- `--workers 1`: Single worker. The `UsageTracker` singleton lives in-process. With multiple workers, each would have a separate in-memory dict (fine for Redis mode, breaks local fallback). For MVP, one worker is sufficient.
- `$PORT`: Railway injects this environment variable automatically.
- `healthcheckPath`: Railway calls `/health` to determine if the deploy succeeded before routing traffic.

---

## Task 8 — Update Tests

**File**: `backend/tests/` (check what exists and update accordingly)

The `UsageTracker` constructor signature changed from `(db_path, max_attempts, enabled)` to `(redis_url, max_attempts, enabled)`. Find any test that constructs `UsageTracker` directly and update:

```python
# Before:
tracker = UsageTracker(db_path=":memory:", max_attempts=3, enabled=True)

# After:
tracker = UsageTracker(redis_url=None, max_attempts=3, enabled=True)
```

`redis_url=None` forces the in-memory fallback — no Redis connection needed in tests.

Also check for any test that imports `_DB_PATH` from `usage.py` — that constant no longer exists. Remove those references.

Run the full test suite and fix any failures before committing:
```bash
uv run pytest -v
```

---

## Verification Checklist

Before committing, verify:

- [ ] `uv run pytest` passes with no failures
- [ ] `uv run ruff check app/` passes (no lint errors)
- [ ] `uv run ruff format --check app/` passes
- [ ] `uv run mypy app/` passes (no type errors)
- [ ] `UsageTracker(redis_url=None, max_attempts=2, enabled=True)` can be instantiated in a Python shell without errors
- [ ] `railway.toml` exists at `backend/railway.toml`
- [ ] `uv.lock` was updated (changed after `uv lock`)

---

## Commit Instructions

Make a single commit with all changes:

```bash
git add backend/pyproject.toml backend/uv.lock \
        backend/app/core/config.py \
        backend/app/core/usage.py \
        backend/app/core/deps.py \
        backend/app/api/routes/chapter.py \
        backend/app/main.py \
        backend/railway.toml
git commit -m "feat(api): replace sqlite usage tracker with async redis, harden middleware

- Swap SQLite for Upstash Redis in UsageTracker; in-memory fallback for local dev
- Make check/increment/remaining async; add await at all call sites in chapter.py
- Add upstash_redis_url and allowed_hosts to Settings
- Add TrustedHostMiddleware, body-size guard (100KB), security response headers
- Create railway.toml with nixpacks build and health check config
- Add redis[asyncio]>=5.0 dependency"
```

---

## Interface Contract (for Agent 2 — Frontend)

The backend API routes are **unchanged**:
- `POST /api/v1/chapter/outline`
- `POST /api/v1/chapter/rewrite`
- `POST /api/v1/chapter/edit`
- `GET /health`

Request/response schemas are **unchanged**. The frontend can continue calling these paths verbatim.

CORS will be set via the `CORS_ORIGINS` environment variable at deploy time. In local dev (`ENV=local`), CORS defaults to an empty list — run the backend with `CORS_ORIGINS='["http://localhost:3000"]'` to allow the local Next.js dev server.
