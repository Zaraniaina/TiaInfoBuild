"""Configuration centralisée via Pydantic Settings (FastAPI Expert pattern)."""
from functools import lru_cache
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_name: str = "TIA Info Build API"

    # Database (MySQL async)
    database_url: str = "mysql+aiomysql://tia_user:tia_password@localhost:3306/tia_build_db"

    # JWT Security
    secret_key: str = "CHANGE_ME_IN_PRODUCTION_ACCESS"
    secret_key_refresh: str = "CHANGE_ME_IN_PRODUCTION_REFRESH"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Password policy
    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_digit: bool = True
    password_require_special: bool = True

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    cors_credentials: bool = True

    # Pagination
    default_page_size: int = 25
    max_page_size: int = 100

    # Multi-tenant defaults
    default_entreprise_devise: str = "MGA"
    default_entreprise_tva: float = 20.0
    default_entreprise_delai_paiement: int = 30

    # Logging
    log_level: str = "INFO"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
