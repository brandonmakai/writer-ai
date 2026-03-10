"""Per-IP usage tracking for outline/rewrite attempt limits."""

import sqlite3
from pathlib import Path

from fastapi import Request

USAGE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS usage (
    ip TEXT PRIMARY KEY,
    used_count INTEGER NOT NULL DEFAULT 0
)
"""


def get_client_ip(request: Request) -> str:
    """Return client IP from X-Forwarded-For, X-Real-IP, or request.client."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.strip().split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


class UsageStore:
    """SQLite-backed store for per-IP attempt counts."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._conn: sqlite3.Connection | None = None

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            if self._path != ":memory:":
                Path(self._path).parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(self._path)
            self._conn.execute(USAGE_TABLE_SQL)
            self._conn.commit()
        return self._conn

    def get_count(self, ip: str) -> int:
        """Return current used_count for the given IP (0 if not seen)."""
        conn = self._get_conn()
        row = conn.execute("SELECT used_count FROM usage WHERE ip = ?", (ip,)).fetchone()
        return row[0] if row else 0

    def increment(self, ip: str) -> None:
        """Increment used_count for the given IP (insert 1 if new)."""
        conn = self._get_conn()
        conn.execute(
            """
            INSERT INTO usage (ip, used_count) VALUES (?, 1)
            ON CONFLICT(ip) DO UPDATE SET used_count = used_count + 1
            """,
            (ip,),
        )
        conn.commit()
