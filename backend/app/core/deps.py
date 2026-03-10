"""Shared FastAPI dependencies."""

from fastapi import Depends, HTTPException

from app.clients.gemini import GeminiClient
from app.core.config import Settings, get_settings
from app.core.usage import UsageStore
from app.domain.services import OutlineService, RewriteService


def get_app_settings() -> Settings:
    """Return application settings instance."""
    return get_settings()


def get_gemini_client(settings: Settings = Depends(get_app_settings)) -> GeminiClient:
    """Return a Gemini client configured from app settings."""
    return GeminiClient(settings)


def get_outline_service(
    client: GeminiClient = Depends(get_gemini_client),
) -> OutlineService:
    """Return the outline service with injected Gemini client."""
    return OutlineService(client)


def get_rewrite_service(
    client: GeminiClient = Depends(get_gemini_client),
) -> RewriteService:
    """Return the rewrite service with injected Gemini client."""
    return RewriteService(client)


def get_usage_store(settings: Settings = Depends(get_app_settings)) -> UsageStore:
    """Return the usage store (SQLite path from settings)."""
    return UsageStore(settings.usage_db_path)


class UsageTracker:
    """Per-IP attempt limit: check before call, increment after success."""

    def __init__(self, store: UsageStore, settings: Settings) -> None:
        self._store = store
        self._limit = settings.max_attempts_per_ip
        self._enabled = settings.limit_usage_per_ip

    def check(self, ip: str) -> None:
        """Raise 429 if this IP has already used max attempts."""
        if not self._enabled:
            return
        if self._store.get_count(ip) >= self._limit:
            raise HTTPException(
                status_code=429,
                detail=f"You've used your {self._limit} free attempts for this experiment.",
            )

    def increment(self, ip: str) -> None:
        """Record one successful use for this IP (no-op if limiting disabled)."""
        if not self._enabled:
            return
        self._store.increment(ip)

    def remaining(self, ip: str) -> int:
        """Return remaining attempts for this IP (after current count)."""
        if not self._enabled:
            return self._limit
        return max(0, self._limit - self._store.get_count(ip))


def get_usage_tracker(
    store: UsageStore = Depends(get_usage_store),
    settings: Settings = Depends(get_app_settings),
) -> UsageTracker:
    """Return the usage tracker for per-IP limits."""
    return UsageTracker(store, settings)


SettingsDep = Depends(get_app_settings)
