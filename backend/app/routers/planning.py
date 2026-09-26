from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models
from app.database import get_db
from app.schemas import ExpeditionOut, LegOut, StationOut

router = APIRouter(tags=["planning"])


@router.get("/stations", response_model=list[StationOut])
def list_stations(db: Session = Depends(get_db)) -> list[models.Station]:
    return list(db.scalars(select(models.Station)))


@router.get("/expeditions", response_model=list[ExpeditionOut])
def list_expeditions(db: Session = Depends(get_db)) -> list[models.Expedition]:
    return list(
        db.scalars(select(models.Expedition).options(selectinload(models.Expedition.legs)))
    )


@router.get("/expeditions/{expedition_id}", response_model=ExpeditionOut)
def get_expedition(expedition_id: str, db: Session = Depends(get_db)) -> models.Expedition:
    exp = db.get(models.Expedition, expedition_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="expedition not found")
    return exp


@router.get("/expeditions/{expedition_id}/timeline")
def expedition_timeline(expedition_id: str, db: Session = Depends(get_db)) -> list[dict]:
    legs = list(db.scalars(select(models.Leg).where(models.Leg.expedition_id == expedition_id)))
    now = max((l.planned_depart for l in legs), default=None)
    return [
        {
            "leg_id": leg.id,
            "from": leg.from_station_id,
            "to": leg.to_station_id,
            "mode": leg.mode,
            "planned_depart": leg.planned_depart,
            "planned_arrive": leg.planned_arrive,
            "status": leg.status,
        }
        for leg in sorted(legs, key=lambda l: l.planned_depart)
    ] if now else []


@router.get("/legs", response_model=list[LegOut])
def list_legs(db: Session = Depends(get_db)) -> list[models.Leg]:
    return list(db.scalars(select(models.Leg)))


@router.get("/legs/{leg_id}/manifest")
def leg_manifest(leg_id: str, db: Session = Depends(get_db)) -> dict:
    leg = db.get(models.Leg, leg_id)
    if leg is None:
        raise HTTPException(status_code=404, detail="leg not found")
    cargo = list(db.scalars(select(models.Consignment).where(models.Consignment.leg_id == leg_id)))
    people = [
        p
        for p in db.scalars(select(models.Personnel))
        if p.state in {"IN_TRANSIT", "REPORTED_GOA"}
    ][:6]
    return {
        "leg": {"id": leg.id, "mode": leg.mode, "planned_depart": leg.planned_depart, "planned_arrive": leg.planned_arrive},
        "cargo": [
            {"id": c.id, "description": c.description, "weight_kg": c.weight_kg, "status": c.status}
            for c in cargo
        ],
        "personnel": [{"id": p.id, "name": p.name, "role": p.role, "state": p.state} for p in people],
    }
