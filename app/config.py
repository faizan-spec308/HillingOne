from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    gemini_api_key: str = ""
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "hillingdon_booking"
    db_user: str = "postgres"
    db_password: str = ""

    @property
    def database_url(self) -> str:
        from urllib.parse import quote_plus
        # URL-encode password so special chars (e.g. @) don't break the DSN
        pw = quote_plus(self.db_password)
        return (
            f"postgresql://{self.db_user}:{pw}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}


settings = Settings()
