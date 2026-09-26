"""Offline-first sync: priority lanes, delta push/pull by Lamport timestamp."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import current_user
from app.schemas import SyncEventIn, SyncEventOut, SyncPushResponse

router = APIRouter(prefix="/sync", tags=["sync"])

LANE_ORDER = {"P0": 0, "P1": 1, "P2": 2}


@router.post("/push", response_model=SyncPushResponse)
def push(
    events: list[SyncEventIn],
    db: Session = Depends(get_db),
    _: models.User = Depends(current_user),
) -> SyncPushResponse:
    """Idempotent by event UUID: re-sends are safe."""
    existing = {
        e.event_uuid for e in db.scalars(select(models.SyncLog))
    }
    accepted = 0
    duplicates = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for ev in events:
        if ev.event_uuid in existing:
            duplicates += 1
            continue
        db.add(
            models.SyncLog(
                id=f"sy-{ev.event_uuid}",
                event_uuid=ev.event_uuid,
                origin_node=ev.origin_node,
                entity=ev.entity,
                op=ev.op,
                payload=ev.payload,
                lamport_ts=ev.lamport_ts,
                priority=ev.priority,
                bytes=ev.bytes,
                applied_at=now,
            )
        )
        existing.add(ev.event_uuid)
        accepted += 1
    db.commit()
    return SyncPushResponse(accepted=accepted, duplicates=duplicates, applied_at=now)


@router.get("/pull", response_model=list[SyncEventOut])
def pull(
    since: int = 0,
    priority: str | None = None,
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[models.SyncLog]:
    query = select(models.SyncLog).where(models.SyncLog.lamport_ts > since)
    if priority:
        query = query.where(models.SyncLog.priority == priority)
    events = list(db.scalars(query))
    events.sort(key=lambda e: (LANE_ORDER.get(e.priority, 9), e.lamport_ts))
    return events[:limit]


@router.get("/status")
def status(db: Session = Depends(get_db)) -> dict:
    logs = list(db.scalars(select(models.SyncLog)))
    lanes = {"P0": 0, "P1": 0, "P2": 0}
    bytes_by_lane = {"P0": 0, "P1": 0, "P2": 0}
    pending = 0
    for log in logs:
        if not log.applied_at:
            lanes[log.priority] = lanes.get(log.priority, 0) + 1
            bytes_by_lane[log.priority] = bytes_by_lane.get(log.priority, 0) + log.bytes
            pending += 1
    return {
        "pending": pending,
        "applied": len(logs) - pending,
        "lanes": lanes,
        "bytes_by_lane": bytes_by_lane,
        "lamport_clock": max((log.lamport_ts for log in logs), default=0),
    }
