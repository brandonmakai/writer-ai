"""Shared FastAPI dependencies."""

from functools import lru_cache

from fastapi import Depends

from app.clients.gemini import GeminiClient
from app.core.config import Settings, get_settings
from app.core.usage import UsageTracker
from app.domain.services import EditService, OutlineService, RewriteService

__all__ = [
    "UsageTracker",
    "get_app_settings",
    "get_edit_service",
    "get_gemini_client",
    "get_outline_service",
    "get_rewrite_service",
    "get_usage_tracker",
]


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


def get_edit_service(
    client: GeminiClient = Depends(get_gemini_client),
) -> EditService:
    """Return the edit service with injected Gemini client."""
    return EditService(client)


@lru_cache(maxsize=1)
def _usage_tracker() -> UsageTracker:
    s = get_settings()
    return UsageTracker(
        redis_url=s.upstash_redis_url,
        max_attempts=s.max_attempts_per_ip,
        enabled=s.limit_usage_per_ip,
        max_tokens_per_ip=s.max_tokens_per_ip,
        max_tokens_global=s.max_tokens_global,
    )


def get_usage_tracker() -> UsageTracker:
    """Return the shared per-IP usage tracker."""
    return _usage_tracker()


SettingsDep = Depends(get_app_settings)
