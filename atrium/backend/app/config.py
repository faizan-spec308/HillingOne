"""Configuration for Atrium backend.

Loads environment variables and provides a singleton settings object.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://atrium:atrium@localhost:5432/atrium"
    gemini_api_key: str = Field(default="")
    gemini_model: str = "gemini-2.5-flash"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    hold_duration_seconds: int = 60
    default_goodwill_credit_percentage: int = 20

    @property
    def async_database_url(self) -> str:
        """Convert bare postgresql:// URL (provided by Render) to asyncpg driver URL."""
        url = self.database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
