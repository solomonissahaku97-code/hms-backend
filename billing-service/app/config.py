"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    env: str = "development"
    debug: bool = True
    port: int = 8000
    host: str = "0.0.0.0"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hms"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expires_in: str = "24h"

    # Inter-service
    hms_backend_url: str = "http://localhost:3000"
    hms_backend_api_key: str = ""
    pharmacy_service_url: str = "http://localhost:3001"

    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
