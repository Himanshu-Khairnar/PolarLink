from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.schemas import (
    AnomalyRow,
    ForecastPoint,
    ForecastResponse,
    LoadOptimizeRequest,
    SimulateRequest,
    SimulateResponse,
)
from app.services import anomaly as anomaly_service
from app.services import forecasting, optimizer, simulation

router = APIRouter(tags=["simulation"])


def _resolve_sku(db: Session, item: str) -> str:
    by_sku = db.scalar(select(models.InventoryItem).where(models.InventoryItem.sku == item))
    if by_sku is not None:
        return by_sku.sku
    by_id = db.get(models.InventoryItem, item)
    if by_id is not None:
        return by_id.sku
    raise HTTPException(status_code=404, detail="item not found")


@router.get("/forecast/{station_id}/{item}", response_model=ForecastResponse)
def forecast(station_id: str, item: str, horizon: int = 90, db: Session = Depends(get_db)) -> ForecastResponse:
    sku = _resolve_sku(db, item)
    history, future, method = forecasting.forecast(station_id, sku, horizon)
    return ForecastResponse(
        station_id=station_id,
        item_id=item,
        method=method,
        history=[round(float(v), 2) for v in history],
        forecast=[ForecastPoint(day=i + 1, value=round(float(v), 2)) for i, v in enumerate(future)],
    )


@router.post("/simulate/season", response_model=SimulateResponse)
def simulate_season(payload: SimulateRequest, db: Session = Depends(get_db)) -> SimulateResponse:
    try:
        result = simulation.simulate(db, payload.target_leg_id, payload.delay_days, payload.runs)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SimulateResponse(**result)


@router.post("/optimize/load")
def optimize_load(payload: LoadOptimizeRequest, db: Session = Depends(get_db)) -> dict:
    try:
        return optimizer.plan_load(db, payload.asset_id, payload.consignment_ids)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/anomalies", response_model=list[AnomalyRow])
def anomalies(db: Session = Depends(get_db)) -> list[AnomalyRow]:
    return anomaly_service.detect(db)
