"""Application configuration and settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = Field(default="local", description="Application environment name.")
    debug: bool = Field(default=True, description="Enable debug mode.")
    log_level: str = Field(default="INFO", description="Root log level.")

    # Gemini will likely be substituted for another LLM provider in the future
    gemini_api_key: str | None = Field(
        default=None,
        description="API key for Gemini or compatible LLM provider.",
    )
    gemini_model: str = Field(
        default="gemini-2.5-flash",
        description="LLM model for rewrites (e.g. gemini-2.5-flash, gemini-1.5-pro).",
    )
    gemini_structured_output: bool = Field(
        default=True,
        description="Use responseMimeType/responseSchema for JSON; set False to debug 400s.",
    )

    cors_origins: list[str] = Field(
        # TODO: remove before going into prod
        default_factory=lambda: ["http://localhost:3000"],
        description="Allowed CORS origins for the frontend.",
    )

    limit_usage_per_ip: bool = Field(
        default=True,
        description="Enforce per-IP attempt limit for outline/rewrite; set False to disable.",
    )
    max_attempts_per_ip: int = Field(
        default=5,
        description="Max successful outline/rewrite calls per IP when limit_usage_per_ip is True.",
    )
    usage_db_path: str = Field(
        default="data/usage.db",
        description="SQLite path for per-IP usage (use :memory: in tests).",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()
