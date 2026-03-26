# Engineering Guidelines

## Core Philosophy

Optimize for:
- Speed
- Simplicity
- High signal changes
- Clean diffs
- Test safety

---

## Commit Rules

- **Commit after making changes** — Do not leave uncommitted work at the end of a task. One or more logical commits per feature/fix.
- One logical change per commit.
- Do not combine unrelated changes.
- Related additions (route + docs + unit test) may be one commit.

### Scope Naming

Use conventional scopes:

- feat(api): ...
- feat(core): ...
- feat(web): ...
- fix(app): ...
- refactor(core): ...

Scopes should match folder or module structure.

### Commit Examples
chore(tooling): add ruff + pytest git automation
- Add [pre-commit] and .pre-commit-config-yaml file to handle pre-commit test automations
- Fix tests: add all more type annotations to test_rewrite_api.py file

Co-authored-by: Cursor <cursoragent@cursor.com>

feat(api): add rewrite/outline endpoint with docs and test
- Wire RewriteService and GeminiClient in deps; add POST
  /api/v1/rewrite/outline
- Document endpoint in backend README
- Add test_rewrite_api with mock service override
- Fix schemas: use min_length instead of deprecated min_items
- Add pytest and pytest-asyncio as dev dependencies

Co-authored-by: Cursor <cursoragent@cursor.com>

---

## Testing & Pre-Commit Enforcement

Pre-commit runs from the **repo root** using [backend/.pre-commit-config.yaml](../backend/.pre-commit-config.yaml). Install hooks with `pre-commit install --config backend/.pre-commit-config.yaml` (from root).

**Backend** (when `backend/` files change): ruff, ruff-format, mypy, pytest.

**Frontend** (when `frontend/` files change): lint, type-check, unit tests (`cd frontend && npm run lint && npm run type-check && npm run test`).

If any commit fails pre-commit:

- Fix the errors before proceeding.
- Do not bypass hooks or disable tests.
- **Backend**: Run `uv run pytest` (and lint/type-check) locally before finalizing.
- **Frontend**: Run `npm run lint && npm run type-check && npm run test` in `frontend/` before finalizing.

Broken code must not be pushed to main.

---

## Frontend: Best Practices, Styles & Tests

- **Stack**: Next.js 15+ (App Router), React 19, Tailwind v4. Frontend lives in `/frontend`.
- **Styles**: Use Tailwind v4 utility classes. Use the shared `cn()` helper from `@/lib/utils` for conditional classes. Prefer design tokens (e.g. `text-foreground`, `bg-background`, `border-border`) over raw colors. The UI is mobile-first: use responsive padding (`--app-px` / safe-area in `globals.css`) and ≥44px touch targets for interactive elements. On small screens, triage "Other beats" stack vertically; the editor exposes structural beats via a header-triggered full-screen panel (below `md`).
- **Structure**: `app/` for routes and layout, `components/` for UI, `lib/` for utilities and shared logic. Keep components focused; extract reusable logic into `lib/` or hooks.
- **Unit tests**: Vitest + React Testing Library + jsdom. Config: `frontend/vitest.config.ts`. Put tests next to code (e.g. `lib/utils.test.ts`) or in a `__tests__` folder. Run with `npm run test` in `frontend/`.
- **E2E / smoke**: Playwright in `frontend/e2e/`. Smoke test ensures homepage loads and the main chapter input is visible; add specs for critical flows. Run with `npm run smoke-test` in `frontend/`.
- **Lint & types**: `npm run lint` (ESLint), `npm run type-check` (tsc). Fix lint and type errors before committing; the pre-commit frontend-check runs these when `frontend/` files change.
- **Commit after changes**: After implementing a feature or fix, commit (and push when ready). Pre-commit will run the appropriate backend or frontend checks.

---

## Quality Expectations

- Avoid unnecessary refactors.
- Do not modify unrelated files.
- Keep functions small and focused.
- Prefer clarity over cleverness.
- Preserve existing architecture unless explicitly instructed.
