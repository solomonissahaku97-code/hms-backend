"""Application configuration."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "development"
    debug: bool = True
    port: int = 3004
    host: str = "0.0.0.0"
    database_url: str = "postgresql+asyncpg://postgres:postgres123@localhost:5433/hms"
    jwt_secret: str = "dev-jwt-secret"
    jwt_algorithm: str = "HS256"
    hms_backend_url: str = "http://localhost:5008"
    hms_service_key: str = "dev-service-key"
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
