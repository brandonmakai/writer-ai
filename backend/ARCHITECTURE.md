# Backend Architecture

FastAPI backend for the **Refine from Structure** MVP. This doc describes layout, data flow, and where to change behavior.

## Layout

```
backend/
├── app/
│   ├── api/routes/     # HTTP endpoints (health, chapter: outline + rewrite + edit)
│   ├── core/           # config, logging, deps, rate limiting, heartbeat, middleware
│   ├── clients/        # external APIs (Gemini)
│   ├── domain/         # business logic (OutlineService, RewriteService, EditService)
│   └── schemas/        # Pydantic request/response models (outline, rewrite, edit, common)
├── tests/
├── main.py             # ASGI entrypoint (fastapi dev main.py)
└── pyproject.toml      # uv project, Ruff/mypy/pytest config
```

- **Routes** only handle HTTP and validation; they call **domain services**.
- **Services** delegate to **GeminiClient**; no prompt building in the route.
- **Schemas** in `app/schemas/` match the contract in docs/LLM_SPEC.md.

## Chapter Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Healthcheck; returns `{"status": "ok"}` |
| POST | `/api/v1/chapter/outline` | Chapter text → 3–8 structural beats (read-only in UI) |
| POST | `/api/v1/chapter/rewrite` | Chapter text + beats → refined chapter, highlights |
| POST | `/api/v1/chapter/edit` | Chapter text + beats + instruction → updated beats (micro-edit) |

## Core Modules

| File | Responsibility |
|------|---------------|
| `core/config.py` | Pydantic `Settings` (LRU-cached); all env var definitions |
| `core/deps.py` | FastAPI `Depends()` factories for `GeminiClient`, `UsageTracker` |
| `core/usage.py` | Per-IP rate limiting — attempt count + token budget (Redis or in-memory) |
| `core/heartbeat.py` | BetterStack ping loop — 7 min normal, 1 min on Gemini quota exhaustion |
| `core/middleware.py` | Content-Type enforcement middleware |
| `core/logging.py` | Logging setup |

## Data Flow: Refine-from-Structure

1. `POST /api/v1/chapter/outline` → validates `OutlineRequest` → `OutlineService` → `GeminiClient.outline_chapter` → `OutlineResponse` (bullets with `label`, `content`, `anchor_text`)
2. `POST /api/v1/chapter/edit` (optional) → `EditRequest` (chapter + bullets + instruction) → `EditService` → `GeminiClient` → updated bullets
3. `POST /api/v1/chapter/rewrite` → `RewriteRequest` (chapter + bullets) → `RewriteService` → `GeminiClient.rewrite_chapter` → `RewriteResponse` (`chapter_text`, `internal_structure`, `change_highlights`)

Rate limiting runs at every endpoint: `UsageTracker.check(ip)` before the call, `UsageTracker.increment(ip)` after success. Remaining count returned in `X-Remaining-Attempts` response header.

## Rate Limiting

Two independent defenses in `core/usage.py`:

1. **Per-IP attempt limit** — max 5 successful calls per IP per 24 h (configurable via `MAX_ATTEMPTS_PER_IP`)
2. **Token limits** — per-IP (50 k tokens/24 h) and optional global cap; blocks large-payload abuse

Backend: Upstash Redis in production (survives redeploys), in-memory dict in local dev (no Redis required).

## BetterStack Heartbeat

`core/heartbeat.py` starts a background asyncio task on startup. Pings `BETTERSTACK_HEARTBEAT_URL` every 7 minutes. When Gemini returns a quota-exhaustion error (402, `QUOTA_EXCEEDED`, `BILLING_DISABLED`), `signal_out_of_credits()` switches cadence to 1-minute pings to trigger an alert. `clear_out_of_credits()` restores normal cadence on success.

## Security Middleware (main.py)

Added in registration order (Starlette applies in reverse):

1. **TrustedHostMiddleware** — rejects unexpected `Host` headers (active when `ALLOWED_HOSTS != ["*"]`)
2. **CORSMiddleware** — restricted to `CORS_ORIGINS`
3. **Body size guard** — returns 413 for payloads > 100 KB
4. **Security response headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`
5. **Content-Type middleware** (`core/middleware.py`) — rejects POST/PUT/PATCH without `application/json`

## Where to Change What

| Change | Location |
|--------|----------|
| Outline prompt (chapter → bullets) | `app/clients/gemini.py` → `_build_outline_prompt` |
| Rewrite prompt / instructions | `app/clients/gemini.py` → `_build_rewrite_prompt` |
| Edit (micro-edit) prompt | `app/clients/gemini.py` → `_build_edit_prompt` |
| LLM model or API config | `app/core/config.py` (`gemini_model`, `gemini_model_fast`) |
| Request/response shape (rewrite) | `app/schemas/rewrite.py`; keep in sync with docs/LLM_SPEC.md |
| Request/response shape (outline) | `app/schemas/outline.py` |
| Request/response shape (edit) | `app/schemas/edit.py` |
| Rate limit thresholds | `app/core/config.py` (`max_attempts_per_ip`, `max_tokens_per_ip`) |
| Heartbeat interval | `app/core/heartbeat.py` constants |
| New endpoints | `app/api/routes/`, register in `app/main.py` |
| New external APIs | `app/clients/`, inject via `app/core/deps.py` |

## Environment Variables

| Variable | Default | Required | Notes |
|----------|---------|----------|-------|
| `GEMINI_API_KEY` | — | Yes | Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | No | Rewrite model |
| `GEMINI_MODEL_FAST` | `gemini-2.5-flash-lite` | No | Outline + edit model |
| `GEMINI_STRUCTURED_OUTPUT` | `true` | No | Set `false` to debug 400s |
| `CORS_ORIGINS` | `[]` | Yes (prod) | `["https://your-app.vercel.app"]` |
| `ALLOWED_HOSTS` | `["*"]` | Yes (prod) | Set to Vercel + Railway domains |
| `UPSTASH_REDIS_URL` | `None` | No | `rediss://...` from Upstash; in-memory fallback if absent |
| `LIMIT_USAGE_PER_IP` | `true` | No | |
| `MAX_ATTEMPTS_PER_IP` | `5` | No | |
| `MAX_TOKENS_PER_IP` | `50000` | No | |
| `MAX_TOKENS_GLOBAL` | `None` | No | Optional global cap across all IPs |
| `BETTERSTACK_HEARTBEAT_URL` | `None` | No | Starts heartbeat loop if set |
| `ENV` | `local` | No | `local` / `staging` / `production` |
| `DEBUG` | `false` | No | Exposes `/docs` and `/redoc` when true |
| `LOG_LEVEL` | `INFO` | No | |

## Dependencies and Config

- **uv**: install with `uv sync` (add `--group dev` for pytest, ruff, mypy).
- **Env**: optional `.env` in `backend/`; all settings have defaults except `GEMINI_API_KEY` and (in production) `CORS_ORIGINS`/`ALLOWED_HOSTS`.
