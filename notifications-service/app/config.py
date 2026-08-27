"""
Configuration — loaded entirely from environment variables.
Never hard-code secrets here.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings sourced from environment variables."""

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "HMS Notifications Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 8000

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres123@db:5432/hms"
    # Sync driver for Alembic migrations / worker
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:postgres123@db:5432/hms"

    # ── Redis ────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/1"
    # Which Redis DB index for the notification queue
    REDIS_QUEUE_DB: int = 2

    # ── Service-to-Service Auth ──────────────────────────────────────────
    # Shared secret — HMS backend and notifications service must both have this.
    SERVICE_AUTH_SECRET: str = "change-me-in-production"
    # HMAC algorithm used for signing requests
    SERVICE_AUTH_ALGORITHM: str = "HS256"

    # ── JWT (for user-facing requests proxied through HMS backend) ──────
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    # ── SMS Provider ─────────────────────────────────────────────────────
    SMS_PROVIDER: str = "twilio"  # twilio | termii | custom
    SMS_API_KEY: str = ""
    SMS_API_SECRET: str = ""
    SMS_SENDER_ID: str = "HMS"

    # ── Email Provider ───────────────────────────────────────────────────
    EMAIL_HOST: str = ""
    EMAIL_PORT: int = 587
    EMAIL_USERNAME: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_FROM: str = "notifications@hms.com"
    EMAIL_USE_TLS: bool = True

    # ── Push Notifications ───────────────────────────────────────────────
    PUSH_ENGAGE_APP_ID: str = ""
    PUSH_ENGAGE_API_KEY: str = ""

    # ── Retry ────────────────────────────────────────────────────────────
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_BASE: int = 30  # seconds

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Cached singleton for app settings."""
    return Settings()
