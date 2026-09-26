"""PolarLink application settings.

Defaults run entirely on SQLite so the prototype starts with a single command.
Point DATABASE_URL at PostgreSQL (optionally + PostGIS) in production and the
rest of the stack is unchanged.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PolarLink API"
    app_version: str = "1.0.0"
    api_prefix: str = ""

    database_url: str = "sqlite:///./polarlink.db"

    jwt_secret: str = "polar-link-dev-secret-change-me-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 12 * 60

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Node identity for the edge instance (used by the sync event log).
    node_id: str = "hq-node"

    seed_on_startup: bool = True
    reset_seed_each_start: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_prefix="POLARLINK_", extra="ignore")


settings = Settings()
