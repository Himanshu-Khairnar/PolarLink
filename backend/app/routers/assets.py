from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import require_roles
from app.schemas import AssetOut, MaintenanceRequest

router = APIRouter(tags=["assets"])


@router.get("/assets", response_model=list[AssetOut])
def list_assets(
    station_id: str | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
) -> list[models.GroundAsset]:
    query = select(models.GroundAsset)
    if station_id:
        query = query.where(models.GroundAsset.station_id == station_id)
    if type:
        query = query.where(models.GroundAsset.type == type)
    return list(db.scalars(query))


@router.post("/assets/{asset_id}/maintenance")
def log_maintenance(
    asset_id: str,
    payload: MaintenanceRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles("hq_logistics", "expedition_leader", "station_leader")),
) -> dict:
    asset = db.get(models.GroundAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="asset not found")

    ts = datetime.now(timezone.utc).replace(tzinfo=None)
    asset.last_service = ts.date()
    asset.next_maintenance = (ts + timedelta(days=90)).date()
    asset.condition = "good"
    log = models.MaintenanceLog(
        id=f"ml-{int(ts.timestamp() * 1000)}",
        asset_id=asset_id,
        action=payload.action,
        by=payload.by,
        ts=ts,
        notes=payload.notes,
    )
    db.add(log)
    db.commit()
    return {"asset_id": asset_id, "action": payload.action, "next_maintenance": asset.next_maintenance, "logged_at": ts}


@router.get("/assets/maintenance/due")
def maintenance_due(days: int = 7, db: Session = Depends(get_db)) -> list[dict]:
    horizon = date.today() + timedelta(days=days)
    due = [
        a
        for a in db.scalars(select(models.GroundAsset))
        if a.next_maintenance <= horizon
    ]
    return [
        {
            "asset_id": a.id,
            "tag": a.tag,
            "name": a.name,
            "station_id": a.station_id,
            "condition": a.condition,
            "next_maintenance": a.next_maintenance,
            "overdue_days": (date.today() - a.next_maintenance).days,
        }
        for a in due
    ]
