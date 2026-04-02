"""Application configuration and settings."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = Field(default="local", description="Application environment name.")
    debug: bool = Field(default=False, description="Enable debug mode.")
    log_level: str = Field(default="INFO", description="Root log level.")

    # Gemini will likely be substituted for another LLM provider in the future
    gemini_api_key: str | None = Field(
        default=None,
        description="API key for Gemini or compatible LLM provider.",
    )
    gemini_model: str = Field(
        default="gemini-2.5-flash",
        description="LLM model for rewrites.",
    )
    gemini_model_fast: str = Field(
        default="gemini-2.5-flash-lite",
        description="LLM model for outline and edit (cheaper, faster).",
    )
    gemini_structured_output: bool = Field(
        default=True,
        description="Use responseMimeType/responseSchema for JSON; set False to debug 400s.",
    )

    cors_origins: list[str] = Field(
        default_factory=list,
        description="Allowed CORS origins. Must be set via CORS_ORIGINS env var in production.",
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
    upstash_redis_url: str | None = Field(
        default=None,
        description=(
            "Redis connection URL for per-IP usage tracking. "
            "Use a rediss:// URL from Upstash. "
            "If None and env is 'local', falls back to in-memory tracking."
        ),
    )
    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["*"],
        description=(
            "Hosts accepted by TrustedHostMiddleware. "
            "In production set to your Vercel domain and Railway custom domain. "
            "Default '*' allows all hosts in local dev."
        ),
    )
    max_tokens_per_ip: int = Field(
        default=50_000,
        description=(
            "Max LLM tokens consumed per IP per 24h window. "
            "Blocks large-payload abuse even within the per-IP attempt limit. "
            "5 normal sessions ≈ 25k tokens; 50k gives 2× headroom."
        ),
    )
    betterstack_heartbeat_url: str | None = Field(
        default=None,
        description=(
            "BetterStack heartbeat URL. If set, the backend pings it every 15 minutes "
            "so BetterStack alerts you when the service goes down."
        ),
    )
    max_tokens_global: int | None = Field(
        default=None,
        description=(
            "Global daily token cap across all IPs. Blocks coordinated VPN-rotation attacks "
            "that exhaust LLM quota by distributing load across many IPs. "
            "None disables the global cap (opt-in — set based on your budget)."
        ),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()
