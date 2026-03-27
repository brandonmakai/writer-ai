# Backend Architecture

FastAPI backend for the **Refine from Structure** MVP. This doc describes layout, data flow, and where to change behavior.

## Layout

```
backend/
├── app/
│   ├── api/routes/     # HTTP endpoints (health, chapter: outline + rewrite)
│   ├── core/           # config, logging, FastAPI deps (e.g. get_gemini_client)
│   ├── clients/        # external APIs (Gemini)
│   ├── domain/         # business logic (RewriteService)
│   └── schemas/        # Pydantic request/response models
├── tests/
├── main.py             # ASGI entrypoint (fastapi dev main.py)
└── pyproject.toml      # uv project, Ruff/mypy/pytest config
```

- **Routes** only handle HTTP and validation; they call **domain services**.
- **RewriteService** delegates to **GeminiClient**; no prompt building in the route.
- **Schemas** in `app/schemas/rewrite.py` match the contract in docs/LLM_SPEC.md.

## Chapter endpoints

- **Outline:** `POST /api/v1/chapter/outline` — chapter text (+ optional tone, language) → 3–8 structural beats (read-only in UI). Request → route → OutlineService → GeminiClient.outline_chapter → OutlineResponse.
- **Rewrite:** `POST /api/v1/chapter/rewrite` — chapter text + beats (as updated by user prompt via micro-edit) → refined chapter and highlights.

## Refine-from-Structure Flow

1. `POST /api/v1/chapter/rewrite` → `app.api.routes.chapter.rewrite_from_outline`
2. Request body is validated as `RewriteRequest` (chapter: { text, optional tone/language }, bullets).
   - `bullets` reflects the current beat state: either the original outline or beats updated by a user prompt via the micro-edit endpoint.
3. Route calls `RewriteService.rewrite(request)` (injected via FastAPI Depends).
4. **RewriteService** calls `GeminiClient.rewrite_chapter(request)`.
5. **GeminiClient** builds the prompt (`_build_rewrite_prompt`), calls Gemini `generateContent`, parses JSON into `RewriteResponse`.
6. Response is returned as JSON: `chapter_text`, `internal_structure`, `change_highlights`.

## Where to Change What

| Change | Location |
|--------|----------|
| Outline prompt (chapter → bullets) | `app/clients/gemini.py` → `_build_outline_prompt` |
| Rewrite prompt / instructions | `app/clients/gemini.py` → `_build_rewrite_prompt` |
| LLM model or API config | `app/core/config.py` (e.g. `gemini_model`), then client uses it |
| Request/response shape (rewrite) | `app/schemas/rewrite.py`; keep in sync with docs/LLM_SPEC.md |
| Request/response shape (outline) | `app/schemas/outline.py` |
| New endpoints | `app/api/routes/`, then register in `app/main.py` |
| New external APIs | `app/clients/`, inject via `app/core/deps.py` |

## Dependencies and Config

- **uv**: install with `uv sync` (add `--group dev` for pytest, ruff, mypy).
- **Env**: optional `.env` in `backend/`; `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, `LOG_LEVEL`) are read by `app.core.config.Settings`.
