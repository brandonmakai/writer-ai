# Narrate AI Backend

FastAPI backend for the **Refine from Structure** MVP. Managed with [uv](https://docs.astral.sh/uv/).

## Quick Start

From this directory:

```bash
uv sync
uv run fastapi dev main.py
```

API docs (debug mode only): http://127.0.0.1:8000/docs

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Healthcheck; returns `{"status": "ok"}` |
| POST | `/api/v1/chapter/outline` | Chapter text → 3–8 read-only structural beats |
| POST | `/api/v1/chapter/edit` | Chapter + beats + instruction → updated beats (micro-edit) |
| POST | `/api/v1/chapter/rewrite` | Chapter + beats → refined chapter text, internal structure, change highlights |

## Commands

- `uv sync` — install dependencies (`uv sync --group dev` for pytest, ruff, mypy)
- `uv run fastapi dev main.py` — dev server with reload
- `uv run fastapi run main.py` — production server
- `uv run pytest` — run tests
- `uv run ruff check app tests` — lint
- `uv run ruff format app tests` — format
- `uv run mypy app` — type check

## Environment Variables

Minimal local dev `.env` in this directory:

```
GEMINI_API_KEY=your-key-here
DEBUG=true
CORS_ORIGINS=["http://localhost:3000"]
```

Full variable reference in [ARCHITECTURE.md](ARCHITECTURE.md#environment-variables).

Key production-only vars: `UPSTASH_REDIS_URL`, `ALLOWED_HOSTS`, `BETTERSTACK_HEARTBEAT_URL`.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for layout, data flow, rate limiting, heartbeat, and where to change prompts/config.
