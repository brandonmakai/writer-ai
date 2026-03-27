# Security Workstream A — Rate Limiting Core + Input Schemas

> **Assigned to:** Cursor (Sonnet)
> **Can run in parallel with:** Workstream B — zero file overlap guaranteed.

---

## Setup

```bash
git checkout main && git pull
git checkout -b feature/claude-task   # or: git checkout feature/claude-task
```

Read `docs/ENGINEERING_GUIDELINES.md` before starting. Commit each TODO separately using conventional commits (`fix(api):`, `refactor(api):`). Run `uv run pytest` from `backend/` before each commit. Ask before pushing or opening a PR.

---

## Files you own (do not touch anything outside this list)

```
backend/app/core/usage.py
backend/app/core/deps.py
backend/app/schemas/edit.py
backend/app/schemas/common.py
backend/tests/test_usage.py
```

---

## TODO A-1 — Fix IP spoofing bypass on rate limiter

**File:** `backend/app/core/usage.py` — function `get_client_ip` (line ~21)

### Why
`get_client_ip()` reads the **first** entry of `X-Forwarded-For`. That entry is user-controlled — anyone can send `X-Forwarded-For: 1.2.3.4` and appear as a new IP with 5 fresh attempts, bypassing the rate limit entirely. On Railway, Render, and Vercel, the platform appends the real client IP as the **last** entry. Trusting the last entry makes spoofing useless.

### Current code
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
Change `[0]` to `[-1]` — trust the rightmost (platform-appended) IP:

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

### Test update
`backend/tests/test_usage.py` already has tests for `get_client_ip`. Find the test that checks `X-Forwarded-For` with a single IP and confirm it still passes. **Add a new test** that sends `X-Forwarded-For: 1.1.1.1, 2.2.2.2` (two entries) and asserts the returned IP is `2.2.2.2` (last), not `1.1.1.1` (first).

### Commit
```
fix(api): trust last X-Forwarded-For entry to prevent IP spoofing
```

---

## TODO A-2 — Wire `max_attempts_per_ip` and `limit_usage_per_ip` from Settings into UsageTracker

**Files:** `backend/app/core/usage.py`, `backend/app/core/deps.py`, `backend/tests/test_usage.py`

### Why
`config.py` (owned by Workstream B) exposes two env-var-configurable settings:
- `limit_usage_per_ip: bool` — toggle to disable limiting in staging
- `max_attempts_per_ip: int` — change attempt cap without a redeploy

Currently `UsageTracker` ignores both. It hardcodes `MAX_ATTEMPTS_PER_IP = 5` at module level. Operators cannot change the limit or disable it without modifying source code.

### Current code

`backend/app/core/usage.py` (top of file):
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
        raise HTTPException(
            status_code=429,
            detail=(
                f"You've used all {MAX_ATTEMPTS_PER_IP} free attempts. "
                "Please try again later."
            ),
        )
```

`UsageTracker.remaining()`:
```python
def remaining(self, ip: str) -> int:
    return max(0, MAX_ATTEMPTS_PER_IP - self.get_count(ip))
```

`backend/app/core/deps.py`:
```python
@lru_cache(maxsize=1)
def _usage_tracker() -> UsageTracker:
    return UsageTracker()
```

### Required changes

**`usage.py`** — add `max_attempts` and `enabled` parameters; remove module-level constant:

```python
class UsageTracker:
    def __init__(
        self,
        db_path: str = _DB_PATH,
        max_attempts: int = 5,
        enabled: bool = True,
    ) -> None:
        self._path = db_path
        self._max = max_attempts
        self._enabled = enabled
        self._conn: sqlite3.Connection | None = None

    def check(self, ip: str) -> None:
        """Raise HTTP 429 if this IP has reached the attempt limit."""
        if not self._enabled:
            return
        if self.get_count(ip) >= self._max:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"You've used all {self._max} free attempts. "
                    "Please try again later."
                ),
            )

    def remaining(self, ip: str) -> int:
        """Return how many attempts remain for the given IP."""
        return max(0, self._max - self.get_count(ip))
```

Remove the `MAX_ATTEMPTS_PER_IP = 5` module-level constant entirely.

**`deps.py`** — pass settings into the tracker:

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

You will need to import `get_settings` in `deps.py` — it is already imported there, check the existing imports before adding a duplicate.

### Test updates
Existing tests in `test_usage.py` construct `UsageTracker()` directly. They will continue to work with the new default parameter values. Add two new tests:
1. `UsageTracker(enabled=False)` — call `check()` 10 times and assert it never raises.
2. `UsageTracker(max_attempts=2)` — call `increment()` twice, then assert `check()` raises 429.

### Commit
```
refactor(api): wire max_attempts_per_ip and limit_usage_per_ip from settings into UsageTracker
```

---

## TODO A-3 — Add length limits on `instruction`, `tone`, and `language` fields

**Files:** `backend/app/schemas/edit.py`, `backend/app/schemas/common.py`

### Why
`ChapterBase.text` is capped at 2500 words. Three other user-supplied string fields are injected directly into Gemini prompts with no size limits. A user could send a 100 KB `instruction` that gets sent straight to Gemini, burning tokens and potentially triggering retry loops.

### Current code

`backend/app/schemas/edit.py` (line ~19):
```python
instruction: str = Field(..., description="Plain-language edit instruction from the user.")
```

`backend/app/schemas/common.py` (lines ~17-24):
```python
tone: str | None = Field(
    default=None,
    description="Optional tone guidance (e.g. darker, lighter, more humorous).",
)
language: str | None = Field(
    default=None,
    description="Optional target language (defaults to original).",
)
```

### Required changes

**`edit.py`:**
```python
instruction: str = Field(
    ...,
    max_length=1000,
    description="Plain-language edit instruction from the user.",
)
```

**`common.py`:**
```python
tone: str | None = Field(
    default=None,
    max_length=200,
    description="Optional tone guidance (e.g. darker, lighter, more humorous).",
)
language: str | None = Field(
    default=None,
    max_length=100,
    description="Optional target language (defaults to original).",
)
```

### Verification
No new test file needed. Add a test in the appropriate existing test file (or create `backend/tests/test_schemas.py`) that constructs an `EditRequest` with an `instruction` longer than 1000 characters and asserts a `ValidationError` is raised. Do the same for `tone` (>200) and `language` (>100) on `ChapterBase`.

### Commit
```
fix(api): add max_length constraints to instruction, tone, and language fields
```

---

## Final check before handing off

```bash
cd backend && uv run pytest
```

All tests must pass. Do not push — hand off the branch name to the project owner for review and merge before Workstream B begins.
