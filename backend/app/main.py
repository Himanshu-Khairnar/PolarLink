"""PolarLink API entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000
Docs:
    http://localhost:8000/docs
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import SessionLocal, init_db
from app.routers import (
    assets,
    auth,
    cargo,
    emergency,
    inventory,
    people,
    planning,
    simulation,
    sync,
    waste,
)
from app.seed import ensure_seeded, seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.seed_on_startup:
        with SessionLocal() as db:
            if settings.reset_seed_each_start:
                seed(db)
            else:
                ensure_seeded(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Offline-first platform for polar expedition planning, cargo chain-of-custody, "
        "station inventory, personnel movement and emergency response. "
        "Problem statement 26062 — MoES / NCPOR."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, planning, cargo, inventory, people, assets, emergency, simulation, sync, waste):
    app.include_router(module.router)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "problem_statement": "26062",
        "modules": [
            "expedition planning",
            "cargo & custody",
            "station inventory & days of autonomy",
            "personnel movement & roll-call",
            "assets & maintenance",
            "emergency response & evacuation",
        ],
        "ai": ["holt-winters forecast", "days of autonomy", "monte carlo simulator", "evac routing", "load optimizer", "delay anomalies"],
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "node": settings.node_id}
