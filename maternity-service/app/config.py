from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres123@localhost:5433/hms"
    JWT_SECRET: str = "change-me"
    HMS_SERVICE_KEY: str = "dev-service-key"
    PORT: int = 3007
    HMS_BACKEND_URL: str = "http://backend:5008"

    class Config:
        env_file = ".env"

settings = Settings()
