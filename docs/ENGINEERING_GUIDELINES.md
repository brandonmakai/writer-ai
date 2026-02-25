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

- One logical change per commit
- Do not combine unrelated changes
- Related additions (route + docs + unit test) may be one commit

### Scope Naming

Use conventional scopes:

- feat(api): ...
- feat(core): ...
- feat(web): ...
- fix(app): ...
- refactor(core): ...

Scopes should match folder or module structure.

---

## Testing & Pre-Commit Enforcement

If any commit fails pre-commit checks (ruff, mypy, pytest):

- You must fix the errors before proceeding.
- Do not bypass hooks.
- Do not disable tests.
- Run `uv run pytest` locally before finalizing changes.

Broken code must not be pushed to main.

---

## Quality Expectations

- Avoid unnecessary refactors.
- Do not modify unrelated files.
- Keep functions small and focused.
- Prefer clarity over cleverness.
- Preserve existing architecture unless explicitly instructed.