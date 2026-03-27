"""Per-IP usage tracking backed by SQLite."""

import sqlite3
from pathlib import Path

from fastapi import HTTPException, Request

MAX_ATTEMPTS_PER_IP = 5

# backend/data/usage.db — two levels up from app/core/
_DB_PATH = str(Path(__file__).resolve().parents[2] / "data" / "usage.db")

_INIT_SQL = """
CREATE TABLE IF NOT EXISTS ip_usage (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
)
"""


def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.strip().split(",")[-1].strip()  # rightmost = platform-trusted
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


class UsageTracker:
    """Track and enforce per-IP attempt limits using a SQLite store."""

    def __init__(self, db_path: str = _DB_PATH) -> None:
        self._path = db_path
        self._conn: sqlite3.Connection | None = None

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            if self._path != ":memory:":
                Path(self._path).parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(self._path)
            self._conn.execute(_INIT_SQL)
            self._conn.commit()
        return self._conn

    def get_count(self, ip: str) -> int:
        """Return the current attempt count for the given IP."""
        conn = self._get_conn()
        row = conn.execute("SELECT count FROM ip_usage WHERE ip = ?", (ip,)).fetchone()
        return int(row[0]) if row else 0

    def check(self, ip: str) -> None:
        """Raise HTTP 429 if this IP has reached the attempt limit."""
        if self.get_count(ip) >= MAX_ATTEMPTS_PER_IP:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"You've used all {MAX_ATTEMPTS_PER_IP} free attempts. Please try again later."
                ),
            )

    def increment(self, ip: str) -> None:
        """Record one attempt for the given IP."""
        conn = self._get_conn()
        conn.execute(
            "INSERT INTO ip_usage (ip, count) VALUES (?, 1) "
            "ON CONFLICT(ip) DO UPDATE SET count = count + 1",
            (ip,),
        )
        conn.commit()

    def remaining(self, ip: str) -> int:
        """Return how many attempts remain for the given IP."""
        return max(0, MAX_ATTEMPTS_PER_IP - self.get_count(ip))
