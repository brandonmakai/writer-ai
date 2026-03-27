# Security Workstream B — Config Hardening + Gemini Client Fixes

> **Assigned to:** Claude Code
> **Can run in parallel with:** Workstream A — zero file overlap guaranteed.

---

## Setup

```bash
git checkout main && git pull
git checkout -b feature/claude-task   # or: git checkout feature/claude-task
```

Read `docs/ENGINEERING_GUIDELINES.md` before starting. Commit each TODO separately using conventional commits (`fix(api):`, `refactor(api):`, `chore(api):`). Run `uv run pytest` from `backend/` before each commit. Ask before pushing or opening a PR.

---

## Files you own (do not touch anything outside this list)

```
backend/app/core/config.py
backend/app/main.py
backend/app/clients/gemini.py
```

---

## TODO B-1 — Set `debug=False` default and disable OpenAPI docs in production

**Files:** `backend/app/core/config.py`, `backend/app/main.py`

### Why

Two separate problems sharing one env-var fix:

1. `debug: bool = Field(default=True)` — when `True`, `GeminiClient` logs the full Gemini response (including user chapter text) via `logger.info("rewrite_chapter response (dev): ...")` on every call. This is a privacy leak and inflates log costs in production. The `self._dev_log = settings.debug` assignment in `GeminiClient.__init__` already gates this logging — the only change needed is the default.

2. FastAPI serves interactive `/docs` (Swagger UI) and `/redoc` in production, exposing the full API schema with live "Try it out" buttons. This makes it trivial for bots to discover and script against your endpoints.

### Current code

`backend/app/core/config.py` (line 15):
```python
debug: bool = Field(default=True, description="Enable debug mode.")
```

`backend/app/main.py` — `FastAPI(...)` constructor (lines 16–20):
```python
app = FastAPI(
    title="Writer AI API",
    description="Backend for the Rewrite from Outline MVP.",
    version="0.1.0",
)
```

`settings = get_settings()` is called on line 22, after the `FastAPI(...)` constructor.

### Required changes

**`config.py`** — flip the default:
```python
debug: bool = Field(default=False, description="Enable debug mode.")
```

**`main.py`** — move `settings = get_settings()` above the `FastAPI(...)` constructor, then pass `docs_url` and `redoc_url` conditionally:
```python
def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
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

    # Routers
    app.include_router(health_router)
    app.include_router(chapter_router, prefix="/api/v1/chapter")

    return app
```

### Verification

Run `uv run pytest` — existing tests must pass. To manually verify: add `DEBUG=true` to `backend/.env`, start the server, confirm `GET /docs` returns 200. Remove it (or set `DEBUG=false`) and confirm `GET /docs` returns 404.

### Commit
```
fix(api): disable OpenAPI docs in production and default debug to False
```

---

## TODO B-2 — Replace `assert` with an explicit guard in `edit_chapter`

**File:** `backend/app/clients/gemini.py` — line 348

### Why

```python
assert llm_result is not None  # loop raises or breaks with result
```

Python's `assert` is silently disabled when the interpreter runs with the `-O` (optimize) flag. Some production deployments use this. If the assert were ever reached (e.g., due to a future refactor), `edit_chapter` would continue with `llm_result = None` and raise a confusing `AttributeError` on the next line rather than a clear error message. An explicit `if` guard works regardless of optimization flags.

### Current code

`backend/app/clients/gemini.py` (line 348):
```python
assert llm_result is not None  # loop raises or breaks with result
```

### Required change

Replace with:
```python
if llm_result is None:
    raise RuntimeError("edit_chapter: llm_result unexpectedly None after parse loop")
```

### Verification

No new test needed — this is a defensive guard for an unreachable state. Run `uv run pytest` to confirm nothing broke.

### Commit
```
fix(api): replace assert with explicit RuntimeError guard in edit_chapter
```

---

## TODO B-3 — Clean up CORS default and remove TODO comment

**File:** `backend/app/core/config.py`

### Why

The current default ships `["http://localhost:3000"]` to production if `CORS_ORIGINS` is not set. An un-set env var should fail loudly (every request gets a CORS error) rather than silently accept only localhost — making misconfiguration obvious. The `# TODO: remove before going into prod` comment has been there since early development and should be removed.

### Current code

`backend/app/core/config.py` (lines 32–36):
```python
cors_origins: list[str] = Field(
    # TODO: remove before going into prod
    default_factory=lambda: ["http://localhost:3000"],
    description="Allowed CORS origins for the frontend.",
)
```

### Required change

```python
cors_origins: list[str] = Field(
    default_factory=list,
    description="Allowed CORS origins. Must be set via CORS_ORIGINS env var in production.",
)
```

`default_factory=list` produces `[]`, which means a production deployment with no `CORS_ORIGINS` env var set will reject all cross-origin requests immediately — loud failure rather than silent misconfiguration.

### Note on deployment

This is partially operational: whoever deploys the backend must set `CORS_ORIGINS` in the production environment before the app can serve the frontend. Example (Railway/Render env var):
```
CORS_ORIGINS=["https://your-app.vercel.app"]
```

### Verification

Run `uv run pytest`. No new tests needed for this change.

### Commit
```
chore(api): remove localhost CORS default and TODO comment
```

---

## TODO B-4 — Reduce `MAX_OUTPUT_TOKENS` for rewrite and add `gemini_model_fast` for outline/edit

**Files:** `backend/app/core/config.py`, `backend/app/clients/gemini.py`

### Why

**Token cap:** `rewrite_chapter` uses `MAX_OUTPUT_TOKENS = 8192`. The maximum chapter input is 2500 words (~3,500 tokens). A rewritten chapter of similar length is ~3,500 tokens output. The current cap is 2.3× what's physically possible — you're billing at the ceiling for no benefit. `4096` gives comfortable headroom.

**Model cost:** All three endpoints use `gemini_model` (default `gemini-2.5-flash`). Outline and edit are structurally simple tasks (extract beats, produce search-replace pairs). They don't require a top-tier reasoning model. Adding a `gemini_model_fast` field (defaulting to `gemini-2.0-flash`) lets you route lighter tasks to a cheaper, faster model via env var — without a code change.

### Current code

`backend/app/core/config.py` (lines 23–26):
```python
gemini_model: str = Field(
    default="gemini-2.5-flash",
    description="LLM model for rewrites (e.g. gemini-2.5-flash, gemini-1.5-pro).",
)
```

`backend/app/clients/gemini.py` — `GeminiClient.__init__` (lines 241–246):
```python
def __init__(self, settings: Settings) -> None:
    self._api_key = settings.gemini_api_key or ""
    self._model = settings.gemini_model
    self._base = GEMINI_BASE
    self._structured_output = settings.gemini_structured_output
    self._dev_log = settings.debug
```

`rewrite_chapter` (line 256):
```python
MAX_OUTPUT_TOKENS = 8192
```

`edit_chapter` uses this URL (line 294):
```python
url = f"{self._base}/models/{self._model}:generateContent"
```

`outline_chapter` uses this URL (line 379):
```python
url = f"{self._base}/models/{self._model}:generateContent"
```

### Required changes

**`config.py`** — add `gemini_model_fast` field directly below `gemini_model`:
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

**`gemini.py`** — update `__init__` to store both models:
```python
def __init__(self, settings: Settings) -> None:
    self._api_key = settings.gemini_api_key or ""
    self._model = settings.gemini_model
    self._model_fast = settings.gemini_model_fast
    self._base = GEMINI_BASE
    self._structured_output = settings.gemini_structured_output
    self._dev_log = settings.debug
```

**`gemini.py`** — reduce rewrite token cap in `rewrite_chapter`:
```python
MAX_OUTPUT_TOKENS = 4096  # was 8192; 2× the hard word cap is ample headroom
```

**`gemini.py`** — switch `edit_chapter` to use `self._model_fast`:
```python
url = f"{self._base}/models/{self._model_fast}:generateContent"
```

**`gemini.py`** — switch `outline_chapter` to use `self._model_fast`:
```python
url = f"{self._base}/models/{self._model_fast}:generateContent"
```

### Verification

Run `uv run pytest`. Manually test outline and edit quality using `gemini-2.0-flash` before deploying. If output quality is insufficient for either endpoint, fall back to `gemini-2.5-flash` via env var (`GEMINI_MODEL_FAST=gemini-2.5-flash`) without a code change.

### Commit
```
refactor(api): reduce rewrite token cap and add gemini_model_fast for outline/edit
```

---

## Final check before handing off

```bash
cd backend && uv run pytest
```

All tests must pass. Do not push — hand off the branch name to the project owner for review and merge before the workstreams are combined.
