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
    stripe_secret_key: str = Field(default="")
    stripe_webhook_secret: str = Field(default="")
    jwt_secret: str = Field(default="atrium-dev-secret-change-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    @property
    def async_database_url(self) -> str:
        """Convert a bare postgresql:// URL to asyncpg format, stripping incompatible params.

        Neon and Render supply URLs like:
          postgresql://user:pass@host/db?sslmode=require
        asyncpg does not accept sslmode as a URL param — SSL is handled via
        connect_args in database.py instead.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Strip ALL query params — asyncpg doesn't accept URL params like
        # sslmode or channel_binding. SSL is handled via connect_args instead.
        if "?" in url:
            url = url[: url.index("?")]
        return url

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
