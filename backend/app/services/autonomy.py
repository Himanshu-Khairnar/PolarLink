"""Days of Autonomy — the survival clock per station.

days_left = first day on which cumulative forecast consumption exceeds stock,
compared against the next feasible resupply window from the transport graph.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.schemas import AutonomyRow
from app.services.forecasting import daily_use


def next_resupply_days(db: Session, station_id: str, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    arrivals = [
        leg.planned_arrive
        for leg in db.scalars(select(models.Leg).where(models.Leg.to_station_id == station_id))
        if leg.planned_arrive >= now
    ]
    if not arrivals:
        return 120
    soonest = min(arrivals)
    return max(1, (soonest - now).days)


def _stock(db: Session, station_id: str, item_id: str) -> float:
    today = date.today()
    batches = db.scalars(
        select(models.InventoryBatch).where(
            models.InventoryBatch.station_id == station_id,
            models.InventoryBatch.item_id == item_id,
        )
    )
    return float(sum(b.qty for b in batches if b.expiry_date >= today))


def compute_autonomy(db: Session, station_id: str, now: datetime | None = None) -> list[AutonomyRow]:
    supply_gap = next_resupply_days(db, station_id, now)
    items = [i for i in db.scalars(select(models.InventoryItem)) if i.category != "waste"]
    rows: list[AutonomyRow] = []

    for item in items:
        stock = _stock(db, station_id, item.id)
        use = daily_use(station_id, item.sku)
        days_left = 9999 if use <= 0 else int(stock / use)
        if days_left < supply_gap:
            risk = "CRITICAL"
        elif days_left < supply_gap * 1.25:
            risk = "WATCH"
        else:
            risk = "OK"
        rows.append(
            AutonomyRow(
                item_id=item.id,
                name=item.name,
                unit=item.unit,
                category=item.category,
                critical=item.critical,
                stock=round(stock, 1),
                daily_use=round(use, 2),
                days_left=days_left,
                next_resupply_days=supply_gap,
                risk=risk,
            )
        )
    return sorted(rows, key=lambda r: r.days_left)
