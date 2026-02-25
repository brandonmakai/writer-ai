"""Shared FastAPI dependencies."""

from fastapi import Depends

from app.clients.gemini import GeminiClient
from app.core.config import Settings, get_settings
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


SettingsDep = Depends(get_app_settings)
