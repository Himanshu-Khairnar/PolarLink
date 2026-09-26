from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import require_roles
from app.schemas import AutonomyRow, InventoryBatchOut, TxnOut, TxnRequest
from app.services import autonomy as autonomy_service

router = APIRouter(tags=["inventory"])


@router.get("/stations/{station_id}/inventory", response_model=list[InventoryBatchOut])
def station_inventory(station_id: str, db: Session = Depends(get_db)) -> list[models.InventoryBatch]:
    return list(
        db.scalars(
            select(models.InventoryBatch).where(models.InventoryBatch.station_id == station_id)
        )
    )


@router.get("/stations/{station_id}/alerts")
def station_alerts(station_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = autonomy_service.compute_autonomy(db, station_id)
    alerts: list[dict] = []
    for row in rows:
        if row.risk == "OK":
            continue
        alerts.append(
            {
                "kind": "stock",
                "severity": "critical" if row.risk == "CRITICAL" else "warning",
                "item_id": row.item_id,
                "title": f"{row.name} {'critical' if row.risk == 'CRITICAL' else 'low'} at station",
                "detail": f"{row.days_left}d cover against a {row.next_resupply_days}d resupply gap.",
            }
        )

    today = date.today()
    expiring = [
        b
        for b in db.scalars(
            select(models.InventoryBatch).where(models.InventoryBatch.station_id == station_id)
        )
        if 0 <= (b.expiry_date - today).days <= 30
    ]
    if expiring:
        alerts.append(
            {
                "kind": "expiry",
                "severity": "warning",
                "title": f"{len(expiring)} batches expiring within 30 days",
                "detail": "Review cold-store rotation before the next consumption cycle.",
            }
        )
    return alerts


@router.get("/stations/{station_id}/autonomy", response_model=list[AutonomyRow])
def station_autonomy(station_id: str, db: Session = Depends(get_db)) -> list[AutonomyRow]:
    if db.get(models.Station, station_id) is None:
        raise HTTPException(status_code=404, detail="station not found")
    return autonomy_service.compute_autonomy(db, station_id)


@router.post("/inventory/txn", response_model=TxnOut)
def create_txn(
    payload: TxnRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(
        require_roles("hq_logistics", "expedition_leader", "station_leader", "inventory_keeper", "medical_officer", "member")
    ),
) -> models.InventoryTxn:
    batch = db.scalar(
        select(models.InventoryBatch).where(
            models.InventoryBatch.station_id == payload.station_id,
            models.InventoryBatch.item_id == payload.item_id,
        )
    )
    if batch is not None:
        batch.qty = max(0.0, batch.qty + payload.delta)
    else:
        # only a positive receipt can open a new batch
        if payload.delta <= 0:
            raise HTTPException(status_code=404, detail="no stock batch for this item")
        batch = models.InventoryBatch(
            id=f"bt-{payload.station_id}-{payload.item_id}",
            station_id=payload.station_id,
            item_id=payload.item_id,
            batch="B-new",
            qty=payload.delta,
            min_threshold=0,
            expiry_date=date.today(),
        )
        db.add(batch)

    ts = datetime.now(timezone.utc).replace(tzinfo=None)
    txn = models.InventoryTxn(
        id=f"txn-{int(ts.timestamp() * 1000)}",
        station_id=payload.station_id,
        item_id=payload.item_id,
        delta=payload.delta,
        reason=payload.reason,
        actor=payload.actor,
        ts=ts,
        origin_node=payload.origin_node or "hq-node",
        event_uuid=f"{payload.station_id}-{payload.item_id}-{int(ts.timestamp())}",
        lamport_ts=int(ts.timestamp()),
    )
    db.add(txn)
    db.add(
        models.SyncLog(
            id=f"sy-txn-{txn.id}",
            event_uuid=txn.event_uuid,
            origin_node=txn.origin_node,
            entity="inventory_txn",
            op="delta",
            payload=f"{payload.reason} {payload.delta:+g}",
            lamport_ts=txn.lamport_ts,
            priority="P1",
            bytes=96,
            applied_at=ts,
        )
    )
    db.commit()
    db.refresh(txn)
    return txn
