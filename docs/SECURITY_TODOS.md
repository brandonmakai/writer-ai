# Security & Cost TODOs — Pre-Launch

> **For the implementing agent:** Before touching any code, run `git checkout main && git checkout -b feature/claude-task` (or `git checkout feature/claude-task` if it already exists). Commit each logical group separately following the project's conventional commit format (`fix(api):`, `chore(api):`, etc.). Run `uv run pytest` and `cd frontend && npm run lint && npm run type-check && npm run test` before committing. Do not combine unrelated changes in one commit. Ask before pushing or opening a PR.

---

## TODO 1 — Fix IP spoofing bypass on rate limiter

**Severity:** Critical
**File:** `backend/app/core/usage.py`

### Context
`get_client_ip()` reads the first entry of the `X-Forwarded-For` header. That entry is user-controlled — anyone can send `X-Forwarded-For: 1.2.3.4` and appear as a fresh IP with 5 new attempts. On Vercel and Railway, the platform appends the real client IP as the **last** entry. Trusting the last entry instead of the first makes spoofing useless.

### Current code (lines 17–27)
```python
def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.strip().split(",")[0].strip()  # ← user-controlled
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"
```

### Required change
Replace `.split(",")[0]` with `.split(",")[-1]` so the function reads the rightmost (platform-appended) IP:

```python
def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.strip().split(",")[-1].strip()  # rightmost = platform-trusted
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"
```

### Verification
`backend/tests/test_usage.py` already tests `get_client_ip`. Add or update a test that passes `X-Forwarded-For: 1.1.1.1, 2.2.2.2` and asserts the returned IP is `2.2.2.2`, not `1.1.1.1`. Run `uv run pytest`.

---

## TODO 2 — Wire `max_attempts_per_ip` and `limit_usage_per_ip` from config into UsageTracker

**Severity:** High
**Files:** `backend/app/core/usage.py`, `backend/app/core/config.py`, `backend/app/core/deps.py`

### Context
`config.py` exposes two settings that operators expect to control via env vars:
- `limit_usage_per_ip: bool` (default `True`) — toggle to disable limiting (e.g. in staging)
- `max_attempts_per_ip: int` (default `5`) — change attempt cap without a deploy

Currently `UsageTracker.check()` ignores both settings entirely and hardcodes `MAX_ATTEMPTS_PER_IP = 5` at module level.

### Current code
`backend/app/core/usage.py` top of file:
```python
MAX_ATTEMPTS_PER_IP = 5
```

`UsageTracker.__init__`:
```python
def __init__(self, db_path: str = _DB_PATH) -> None:
    self._path = db_path
    self._conn: sqlite3.Connection | None = None
```

`UsageTracker.check()`:
```python
def check(self, ip: str) -> None:
    if self.get_count(ip) >= MAX_ATTEMPTS_PER_IP:
        raise HTTPException(...)
```

`UsageTracker.remaining()`:
```python
def remaining(self, ip: str) -> int:
    return max(0, MAX_ATTEMPTS_PER_IP - self.get_count(ip))
```

### Required change
Pass `Settings` into `UsageTracker` so the limits are live-configurable:

```python
class UsageTracker:
    def __init__(self, db_path: str = _DB_PATH, max_attempts: int = 5, enabled: bool = True) -> None:
        self._path = db_path
        self._max = max_attempts
        self._enabled = enabled
        self._conn: sqlite3.Connection | None = None

    def check(self, ip: str) -> None:
        if not self._enabled:
            return
        if self.get_count(ip) >= self._max:
            raise HTTPException(
                status_code=429,
                detail=f"You've used all {self._max} free attempts. Please try again later.",
            )

    def remaining(self, ip: str) -> int:
        return max(0, self._max - self.get_count(ip))
```

In `backend/app/core/deps.py`, update `_usage_tracker()` to read from settings:
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

### Verification
Update `backend/tests/test_usage.py` — existing tests construct `UsageTracker()` directly; pass explicit `max_attempts=5` to keep them working. Add a test that passes `enabled=False` and asserts `check()` never raises. Run `uv run pytest`.

---

## TODO 3 — Disable debug mode and OpenAPI docs in production

**Severity:** High
**File:** `backend/app/core/config.py`, `backend/app/main.py`

### Context
Two separate issues that share one env-var fix:

1. `debug: bool = Field(default=True)` — when True, `GeminiClient` logs the full Gemini response (including user chapter text) on every call via `logger.info("rewrite_chapter response (dev): ...")`. This is a privacy concern and inflates log costs in production.

2. FastAPI serves interactive `/docs` (Swagger UI) and `/redoc` by default. In production this exposes the full API schema with live "Try it out" buttons, making it easy for bots to discover and script against your endpoints.

### Required changes

**`backend/app/core/config.py` — change default to False:**
```python
debug: bool = Field(default=False, description="Enable debug mode.")
```

**`backend/app/main.py` — disable docs when not in debug:**
```python
app = FastAPI(
    title="Writer AI API",
    description="Backend for the Rewrite from Outline MVP.",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)
```

`settings` is already loaded just below `create_app()` — move the `get_settings()` call above the `FastAPI(...)` constructor so it's available when constructing the app.

### Verification
Set `DEBUG=false` in your local `.env`, restart the server, and confirm `GET /docs` returns 404. Set `DEBUG=true` and confirm `/docs` returns 200. Run `uv run pytest`.

---

## TODO 4 — Add length limits on `instruction`, `tone`, and `language` fields

**Severity:** High
**Files:** `backend/app/schemas/edit.py`, `backend/app/schemas/common.py`

### Context
`ChapterBase.text` is capped at 2500 words, but three other user-supplied fields are injected directly into Gemini prompts with no size limits:
- `instruction` (EditRequest) — no max length; a 100 KB instruction would be sent to Gemini as-is
- `tone` (ChapterBase) — injected into all three endpoint prompts
- `language` (ChapterBase) — same

A malicious user could inflate token costs or cause repeated retry loops.

### Required changes

**`backend/app/schemas/edit.py`** — add `max_length` to `instruction`:
```python
instruction: str = Field(
    ...,
    max_length=1000,
    description="Plain-language edit instruction from the user.",
)
```

**`backend/app/schemas/common.py`** — add `max_length` to `tone` and `language`:
```python
tone: str | None = Field(
    default=None,
    max_length=200,
    description="Optional tone guidance.",
)
language: str | None = Field(
    default=None,
    max_length=100,
    description="Optional target language.",
)
```

### Verification
Write a quick test (or use the existing test patterns in `backend/tests/`) that POSTs an `instruction` longer than 1000 characters and asserts a 422 response. Run `uv run pytest`.

---

## TODO 5 — Replace `assert` with an explicit guard in `edit_chapter`

**Severity:** Medium
**File:** `backend/app/clients/gemini.py`

### Context
Near the end of `GeminiClient.edit_chapter()`, there is:
```python
assert llm_result is not None  # loop always returns or raises
```

Python's `assert` statement is silently disabled when the interpreter runs with the `-O` (optimize) flag, which some production deployments use. If the assert were ever reached (e.g. due to a future refactor), the function would continue with `llm_result = None` and produce a confusing `AttributeError` downstream rather than a clear error message.

### Required change
Replace with an explicit runtime check:
```python
if llm_result is None:
    raise RuntimeError("edit_chapter: llm_result unexpectedly None after parse loop")
```

### Verification
No test needed — this is a defensive guard for an unreachable state. Confirm `uv run ruff check` and `uv run mypy app/` pass cleanly.

---

## TODO 6 — Set CORS origins via environment variable (do not hardcode)

**Severity:** Critical (blocks launch)
**File:** `backend/app/core/config.py`

### Context
The current default:
```python
cors_origins: list[str] = Field(
    # TODO: remove before going into prod
    default_factory=lambda: ["http://localhost:3000"],
)
```

This TODO comment has been in place since early development. If `CORS_ORIGINS` is not set in the production environment, the backend will reject every request from the live frontend domain with a CORS error, making the app completely non-functional.

### Required change
The field definition is already correct — it reads from `CORS_ORIGINS` env var via pydantic-settings. No code change is needed. The action item is **operational**:

1. In your production deployment (Railway, Render, etc.), set the environment variable:
   ```
   CORS_ORIGINS=["https://your-app.vercel.app"]
   ```
2. Remove the `# TODO: remove before going into prod` comment from `config.py` once the env var is confirmed set.
3. If you want to be explicit about no default in production, change:
   ```python
   cors_origins: list[str] = Field(
       default_factory=list,
       description="Allowed CORS origins. Must be set in production.",
   )
   ```
   This makes a misconfigured production deployment fail loudly (CORS error on first request) rather than silently accepting localhost.

### Verification
Deploy to staging with `CORS_ORIGINS` set to your staging frontend URL. Open the frontend and confirm the API calls succeed (no CORS errors in browser console).

---

## TODO 7 — Replace SQLite rate-limit store with a serverless-compatible backend (if deploying backend to Vercel)

**Severity:** Critical if using Vercel serverless for the backend; N/A if using Railway/Render
**Files:** `backend/app/core/usage.py`, `backend/app/core/deps.py`, `backend/app/core/config.py`

### Context
`UsageTracker` writes to a local SQLite file at `data/usage.db`. Vercel serverless functions run in ephemeral read-only containers — each cold start gets a fresh empty database, making the rate limiter reset to zero on every invocation.

**If you deploy the FastAPI backend to Railway or Render (recommended):** SQLite works fine on a persistent server. Skip this TODO entirely.

**If you deploy the FastAPI backend to Vercel Python serverless:** Replace SQLite with [Upstash Redis](https://upstash.com) (free tier: 10,000 requests/day, no credit card required).

### Required changes (Upstash path only)

Add to `pyproject.toml` dependencies:
```toml
"upstash-redis>=1.0.0",
```

Add to `config.py`:
```python
upstash_redis_url: str | None = Field(default=None, description="Upstash Redis REST URL.")
upstash_redis_token: str | None = Field(default=None, description="Upstash Redis REST token.")
```

Rewrite `UsageTracker` in `usage.py` with an `upstash_redis` backend (the Upstash REST client is HTTP-based and works in serverless without a persistent connection). The public interface (`check`, `increment`, `remaining`, `get_count`) stays identical so no route changes are needed.

Set env vars in Vercel dashboard:
```
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
```

### Verification
Deploy to staging. Make 5 requests from the same IP, confirm the 6th returns 429. Redeploy (triggering a cold start) and confirm the count persists (not reset to zero).

---

## TODO 8 — Reduce `MAX_OUTPUT_TOKENS` for rewrite and consider cheaper model for outline/edit

**Severity:** Cost
**File:** `backend/app/clients/gemini.py`, `backend/app/core/config.py`

### Context

**Token cap:** `rewrite_chapter` sets `MAX_OUTPUT_TOKENS = 8192`. The maximum chapter input is 2500 words (~3,500 tokens). A rewritten chapter of similar length is ~3,500 tokens output. The current cap is 2.3× what's physically possible, billing you at the ceiling for no benefit.

**Model:** All three endpoints use `gemini_model` (default `gemini-2.5-flash`). Outline and edit are structurally simple tasks (extract beats, produce search-replace pairs) that don't need a top-tier reasoning model. A cheaper, faster model for these would reduce cost without affecting quality.

### Required changes

**`backend/app/clients/gemini.py`** — reduce rewrite token cap:
```python
# rewrite_chapter method
MAX_OUTPUT_TOKENS = 4096  # was 8192; 2× the hard word cap is ample headroom
```

**`backend/app/core/config.py`** — add a second model field for lighter tasks:
```python
gemini_model: str = Field(
    default="gemini-2.5-flash",
    description="LLM model for rewrites.",
)
gemini_model_fast: str = Field(
    default="gemini-2.0-flash",
    description="LLM model for outline and edit (cheaper, faster).",
)
```

**`backend/app/clients/gemini.py`** — use `gemini_model_fast` in `outline_chapter` and `edit_chapter`:
```python
def __init__(self, settings: Settings) -> None:
    self._api_key = settings.gemini_api_key or ""
    self._model = settings.gemini_model          # rewrite
    self._model_fast = settings.gemini_model_fast  # outline + edit
    ...
```

In `outline_chapter` and `edit_chapter`, replace:
```python
url = f"{self._base}/models/{self._model}:generateContent"
```
with:
```python
url = f"{self._base}/models/{self._model_fast}:generateContent"
```

### Verification
Run `uv run pytest`. Manually test outline and edit quality at `gemini-2.0-flash` to confirm acceptable output before deploying. If quality is insufficient, fall back to `gemini-2.5-flash` for that endpoint via env var.

---

## Execution order recommendation

Work through these in this order — each is an independent commit:

1. **TODO 1** — IP fix (2 min, highest leverage per line of code)
2. **TODO 3** — debug=False default + disable docs (5 min)
3. **TODO 4** — field length limits (5 min)
4. **TODO 5** — replace assert (2 min)
5. **TODO 2** — wire config into UsageTracker (15 min)
6. **TODO 8** — cost/token tuning (10 min)
7. **TODO 6** — CORS env var (operational, no code required beyond comment removal)
8. **TODO 7** — SQLite replacement (30 min, only if Vercel serverless for backend)
