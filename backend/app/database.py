from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

url = settings.database_url
is_sqlite = url.startswith("sqlite")
is_postgres = url.startswith("postgresql") or url.startswith("postgres://")

connect_args: dict = {}
if is_sqlite:
    connect_args["check_same_thread"] = False
elif is_postgres:
    # Managed/serverless Postgres (Neon, Supabase, Render, Aiven) always needs
    # TLS and usually sits behind PgBouncer in transaction mode, which cannot
    # keep prepared statements. Disable psycopg's automatic preparation so the
    # pooler works, and don't hold idle connections so Neon can autosuspend.
    connect_args["sslmode"] = "require"
    connect_args["prepare_threshold"] = None

engine = create_engine(
    url,
    connect_args=connect_args,
    pool_pre_ping=True,
    poolclass=NullPool if is_postgres else None,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401  (register metadata)

    Base.metadata.create_all(bind=engine)
