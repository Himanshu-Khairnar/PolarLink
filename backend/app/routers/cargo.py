from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import require_roles
from app.hashchain import GENESIS_HASH, new_event_hash, verify_chain
from app.schemas import (
    ConsignmentOut,
    CustodyEventOut,
    ScanRequest,
    ScanResponse,
    VerifyResponse,
)
from app.ws import manager

router = APIRouter(tags=["cargo"])

FLOW = [
    "PLANNED",
    "PACKED_GOA",
    "IN_TRANSIT_TO_PORT",
    "AT_PORT",
    "AT_HUB",
    "LOADED",
    "OFFLOADED",
    "RECEIVED_STATION",
    "CONSUMED",
]

# Explicitly allowed transitions; illegal jumps are rejected.
ALLOWED: dict[str, set[str]] = {
    FLOW[i]: {FLOW[i + 1]} for i in range(len(FLOW) - 1)
}
ALLOWED["RECEIVED_STATION"] |= {"RETROGRADE", "WASTE_RETURNED", "CONSUMED"}
ALLOWED["RETROGRADE"] = {"WASTE_RETURNED"}

STATE_STATION = {
    "PLANNED": "st-hq", "PACKED_GOA": "st-hq", "IN_TRANSIT_TO_PORT": "st-hq",
    "AT_PORT": "st-mum", "AT_HUB": "st-cpt", "LOADED": "st-ship",
    "OFFLOADED": "st-cpt", "RECEIVED_STATION": "st-bharati", "CONSUMED": "st-bharati",
    "RETROGRADE": "st-cpt", "WASTE_RETURNED": "st-cpt",
}


@router.get("/consignments", response_model=list[ConsignmentOut])
def list_consignments(
    category: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[models.Consignment]:
    query = select(models.Consignment)
    if category:
        query = query.where(models.Consignment.category == category)
    if status:
        query = query.where(models.Consignment.status == status)
    return list(db.scalars(query))


@router.get("/consignments/{consignment_id}", response_model=ConsignmentOut)
def get_consignment(consignment_id: str, db: Session = Depends(get_db)) -> models.Consignment:
    cs = db.get(models.Consignment, consignment_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="consignment not found")
    return cs


@router.get("/consignments/{consignment_id}/custody", response_model=list[CustodyEventOut])
def custody_timeline(consignment_id: str, db: Session = Depends(get_db)) -> list[models.CustodyEvent]:
    events = list(
        db.scalars(
            select(models.CustodyEvent).where(models.CustodyEvent.consignment_id == consignment_id)
        )
    )
    return sorted(events, key=lambda e: e.ts)


@router.get("/consignments/{consignment_id}/verify", response_model=VerifyResponse)
def verify(consignment_id: str, db: Session = Depends(get_db)) -> VerifyResponse:
    events = custody_timeline(consignment_id, db)
    payload = [
        {
            "id": e.id,
            "consignment_id": e.consignment_id,
            "to_state": e.to_state,
            "ts": e.ts.isoformat(),
            "station_id": e.station_id,
            "scanned_by": e.scanned_by,
            "prev_hash": e.prev_hash,
            "hash": e.hash,
        }
        for e in events
    ]
    ok, broken_at = verify_chain(payload)
    return VerifyResponse(consignment_id=consignment_id, ok=ok, broken_at=broken_at, events=len(events))


@router.post("/scan/{qr_code}", response_model=ScanResponse)
async def scan(
    qr_code: str,
    payload: ScanRequest | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(
        require_roles("hq_logistics", "expedition_leader", "station_leader", "inventory_keeper", "ship_air_ops")
    ),
) -> ScanResponse:
    payload = payload or ScanRequest(qr_code=qr_code)
    cs = db.scalar(select(models.Consignment).where(models.Consignment.qr_code == qr_code))
    if cs is None:
        raise HTTPException(status_code=404, detail="unknown QR code")

    if cs.status in FLOW and FLOW.index(cs.status) < len(FLOW) - 1:
        default_next: str | None = FLOW[FLOW.index(cs.status) + 1]
    else:
        default_next = None
    to_state = payload.to_state or default_next

    if to_state is None:
        raise HTTPException(
            status_code=409,
            detail=f"Consignment is in a terminal state ({cs.status}); provide an explicit to_state.",
        )
    if to_state != cs.status:
        allowed = ALLOWED.get(cs.status, set())
        if to_state not in allowed:
            raise HTTPException(
                status_code=409,
                detail=f"Illegal transition {cs.status} -> {to_state}. Allowed: {sorted(allowed)}",
            )

    prev = db.scalars(
        select(models.CustodyEvent)
        .where(models.CustodyEvent.consignment_id == cs.id)
        .order_by(models.CustodyEvent.ts.desc())
    ).first()
    prev_hash = prev.hash if prev else GENESIS_HASH

    station_id = payload.station_id or STATE_STATION.get(to_state, cs.destination_station_id)
    station = db.get(models.Station, station_id)
    ts = datetime.now(timezone.utc).replace(tzinfo=None)
    h = new_event_hash(prev_hash, cs.id, to_state, ts, station_id, payload.scanned_by)

    event = models.CustodyEvent(
        id=f"ce-{cs.id}-{int(ts.timestamp())}-{uuid4().hex[:6]}",
        consignment_id=cs.id,
        leg_id=cs.leg_id,
        station_id=station_id,
        event_type=f"scan:{to_state.lower()}",
        from_state=cs.status,
        to_state=to_state,
        scanned_by=payload.scanned_by,
        ts=ts,
        lat=payload.lat if payload.lat is not None else (station.lat if station else 0.0),
        lon=payload.lon if payload.lon is not None else (station.lon if station else 0.0),
        prev_hash=prev_hash,
        hash=h,
    )
    cs.status = to_state
    db.add(event)

    priority = "P0" if cs.priority == "P0" else "P1"
    db.add(
        models.SyncLog(
            id=f"sy-scan-{event.id}",
            event_uuid=h[:12],
            origin_node="edge-node",
            entity="custody_event",
            op="append",
            payload=f"{cs.qr_code}->{to_state}",
            lamport_ts=int(ts.timestamp()),
            priority=priority,
            bytes=168,
            applied_at=ts,
        )
    )
    db.commit()
    db.refresh(event)

    await manager.broadcast(
        "custody",
        {"type": "scan", "consignment_id": cs.id, "status": to_state, "hash": h[:12], "priority": priority},
    )
    return ScanResponse(consignment=cs, event=event, priority=priority)
