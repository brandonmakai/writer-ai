"""Shared FastAPI dependencies."""

from fastapi import Depends

from app.core.config import Settings, get_settings


def get_app_settings() -> Settings:
    """Return application settings instance."""
    return get_settings()


SettingsDep = Depends(get_app_settings)

