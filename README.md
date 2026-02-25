# Writer AI

Monorepo for the **Rewrite from Outline** MVP: edit chapter structure as bullets and get a coherent refactored chapter.

## Repo layout

- **`/backend`** — FastAPI app (Python, uv). Rewrite-from-outline API, Gemini client, tests.
- **`/docs`** — Product spec, LLM contract, and engineering guidelines (see below).

## Run the backend

From the repo root:

```bash
cd backend
uv sync
uv run fastapi dev main.py
```

API docs: http://127.0.0.1:8000/docs

For more commands (tests, lint, typecheck), see [backend/README.md](backend/README.md).

## Docs

- [docs/PRODUCT.md](docs/PRODUCT.md) — MVP feature and user flow
- [docs/LLM_SPEC.md](docs/LLM_SPEC.md) — Required LLM JSON output contract
- [docs/ENGINEERING_GUIDELINES.md](docs/ENGINEERING_GUIDELINES.md) — Commit scope, testing, pre-commit
- [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md) — Backend layout and where to change prompts/LLM