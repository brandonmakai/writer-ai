# Writer AI Backend

FastAPI backend for the **Rewrite from Outline** MVP. Managed with [uv](https://docs.astral.sh/uv/).

## Quick start

From this directory:

```bash
uv sync
uv run fastapi dev main.py
```

API docs: http://127.0.0.1:8000/docs

## Endpoints

| Method | Path     | Description                |
|--------|----------|----------------------------|
| GET    | `/health` | Healthcheck; returns `{"status": "ok"}` |

## Commands

- `uv sync` — install dependencies
- `uv run fastapi dev main.py` — run dev server with reload
- `uv run fastapi run main.py` — run production server
