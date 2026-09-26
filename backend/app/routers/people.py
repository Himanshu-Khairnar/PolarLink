from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import require_roles
from app.schemas import MovementRequest, PersonnelOut, RollCallOut

router = APIRouter(tags=["personnel"])


@router.get("/personnel", response_model=list[PersonnelOut])
def list_personnel(
    team: str | None = None,
    station_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[models.Personnel]:
    query = select(models.Personnel)
    if team:
        query = query.where(models.Personnel.team == team)
    if station_id:
        query = query.where(models.Personnel.station_id == station_id)
    return list(db.scalars(query))


@router.get("/personnel/{person_id}", response_model=PersonnelOut)
def get_person(person_id: str, db: Session = Depends(get_db)) -> models.Personnel:
    person = db.get(models.Personnel, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="person not found")
    return person


@router.post("/movements", response_model=PersonnelOut)
def create_movement(
    payload: MovementRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles("hq_logistics", "expedition_leader", "station_leader")),
) -> models.Personnel:
    person = db.get(models.Personnel, payload.person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="person not found")
    person.state = payload.status
    db.commit()
    db.refresh(person)
    return person


@router.get("/stations/{station_id}/rollcall", response_model=RollCallOut)
def rollcall(station_id: str, db: Session = Depends(get_db)) -> RollCallOut:
    people = list(
        db.scalars(
            select(models.Personnel).where(
                models.Personnel.station_id == station_id,
                models.Personnel.state == "AT_STATION",
            )
        )
    )
    # The muster UI toggles presence client-side; the server reports the roster
    # that must be accounted for (all personnel currently on station).
    return RollCallOut(
        station_id=station_id,
        accounted=[p.id for p in people],
        unaccounted=[],
        total=len(people),
    )
