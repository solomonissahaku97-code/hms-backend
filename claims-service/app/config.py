"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    env: str = "development"
    debug: bool = True
    port: int = 3002
    host: str = "0.0.0.0"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres123@localhost:5432/hms_claims"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # Inter-service
    hms_backend_url: str = "http://localhost:5008"
    hms_service_key: str = "dev-service-key"

    # NHIA Export
    export_dir: str = "./exports"

    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
