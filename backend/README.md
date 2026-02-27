# Writer AI Backend

FastAPI backend for the **Rewrite from Outline** MVP. Managed with [uv](https://docs.astral.sh/uv/).

## Quick start

From this directory:

```bash
uv sync
uv run fastapi dev main.py
```

API docs: http://127.0.0.1:8000/docs

Optional `.env` in this directory: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `GEMINI_STRUCTURED_OUTPUT` (default `true`; set to `false` to disable responseSchema and debug 400s).

## Endpoints

| Method | Path                          | Description                                                                 |
|--------|-------------------------------|-----------------------------------------------------------------------------|
| GET    | `/health`                     | Healthcheck; returns `{"status": "ok"}`.                                   |
| POST   | `/api/v1/chapter/outline`     | Chapter text (+ optional tone, language); returns 3–8 structural bullets.  |
| POST   | `/api/v1/chapter/rewrite`     | Refactor chapter from outline; body: `chapter` (e.g. `{ text, tone?, language? }`), `bullets` (3–8); returns refactored chapter, internal structure, change highlights. |

## Commands

- `uv sync` — install dependencies (include dev: `uv sync --group dev`)
- `uv run fastapi dev main.py` — run dev server with reload
- `uv run fastapi run main.py` — run production server
- `uv run pytest` — run tests
- `uv run ruff check app tests` — lint
- `uv run ruff format app tests` — format
- `uv run mypy app` — type check
