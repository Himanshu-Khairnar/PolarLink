from __future__ import annotations

import struct
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import current_user, require_roles
from app.schemas import EvacRouteOut, IncidentAdvance, IncidentOut, SosRequest, WeatherGate
from app.services import evacuation, weather as weather_service
from app.ws import manager

router = APIRouter(tags=["emergency"])

TYPE_CODE = {"medical": 1, "fire": 2, "missing_person": 3, "equipment": 4, "weather": 5}
SEV_CODE = {"low": 1, "medium": 2, "high": 3, "critical": 4}
TYPE_BY_CODE = {v: k for k, v in TYPE_CODE.items()}
SEV_BY_CODE = {v: k for k, v in SEV_CODE.items()}


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(db: Session = Depends(get_db)) -> list[models.Incident]:
    return list(db.scalars(select(models.Incident).order_by(models.Incident.created_at.desc())))


@router.get("/incidents/{incident_id}/actions")
def incident_actions(incident_id: str, db: Session = Depends(get_db)) -> list[dict]:
    actions = [
        a for a in db.scalars(select(models.IncidentAction)) if a.incident_id == incident_id
    ]
    return [
        {"id": a.id, "action": a.action, "by": a.by, "ts": a.ts}
        for a in sorted(actions, key=lambda a: a.ts)
    ]


@router.post("/sos", response_model=IncidentOut)
async def raise_sos(
    payload: SosRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(current_user),
) -> models.Incident:
    ts = datetime.now(timezone.utc).replace(tzinfo=None)
    incident = models.Incident(
        id=f"in-{int(ts.timestamp() * 1000)}",
        type=payload.type,
        severity=payload.severity,
        station_id=payload.station_id,
        person_id=payload.person_id,
        summary=payload.summary,
        reported_by=payload.reported_by,
        status="RAISED",
        created_at=ts,
    )
    db.add(incident)
    db.add(
        models.IncidentAction(
            id=f"ia-{incident.id}", incident_id=incident.id,
            action="SOS received on P0 lane; incident opened.", by=payload.reported_by, ts=ts,
        )
    )
    db.add(
        models.SyncLog(
            id=f"sy-sos-{incident.id}", event_uuid=incident.id, origin_node=payload.reported_by,
            entity="incident", op="create", payload=f"{payload.type}:{payload.severity}",
            lamport_ts=int(ts.timestamp()), priority="P0", bytes=74, applied_at=ts,
        )
    )
    db.commit()
    db.refresh(incident)
    await manager.broadcast("incidents", {"type": "sos", "incident_id": incident.id, "severity": payload.severity, "station_id": payload.station_id})
    return incident


@router.post("/incidents/{incident_id}/advance", response_model=IncidentOut)
async def advance_incident(
    incident_id: str,
    payload: IncidentAdvance,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles("hq_logistics", "expedition_leader", "station_leader", "medical_officer")),
) -> models.Incident:
    incident = db.get(models.Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    incident.status = payload.status
    ts = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(
        models.IncidentAction(
            id=f"ia-{incident_id}-{int(ts.timestamp())}", incident_id=incident_id,
            action=payload.action, by=payload.by, ts=ts,
        )
    )
    db.commit()
    db.refresh(incident)
    await manager.broadcast("incidents", {"type": "advance", "incident_id": incident_id, "status": payload.status})
    return incident


# ---- Compact SOS packet: station(1) type(1) severity(1) person(2) lat(4) lon(4) ts(4) crc(2) = 19 bytes ----
def _pack_sos(station_index: int, type_code: int, sev_code: int, person: int, lat: float, lon: float, ts: int) -> bytes:
    lat_i = int(lat * 1e5)
    lon_i = int(lon * 1e5)
    body = struct.pack(">BBB H i i I", station_index, type_code, sev_code, person, lat_i, lon_i, ts)
    crc = 0
    for b in body:
        crc ^= b
    return body + struct.pack(">H", crc & 0xFFFF)


def _unpack_sos(raw: bytes) -> tuple[int, int, int, int, float, float, int]:
    if len(raw) < 19:
        raise ValueError("packet too short")
    station_index, type_code, sev_code, person, lat_i, lon_i, ts = struct.unpack(">BBB H i i I", raw[:17])
    crc = 0
    for b in raw[:17]:
        crc ^= b
    if (crc & 0xFFFF) != struct.unpack(">H", raw[17:19])[0]:
        raise ValueError("packet CRC mismatch")
    return station_index, type_code, sev_code, person, lat_i / 1e5, lon_i / 1e5, ts


@router.post("/sos/encode")
def encode_sos(
    payload: SosRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(current_user),
) -> Response:
    stations = list(db.scalars(select(models.Station)))
    index = next((i for i, s in enumerate(stations) if s.id == payload.station_id), 0)
    packet = _pack_sos(
        index, TYPE_CODE[payload.type], SEV_CODE[payload.severity],
        1, payload.lat or 0.0, payload.lon or 0.0, int(datetime.now(timezone.utc).timestamp()),
    )
    return Response(content=packet, media_type="application/octet-stream", headers={"X-Packet-Bytes": str(len(packet))})


@router.post("/sos/compact", response_model=IncidentOut)
async def compact_sos(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
) -> models.Incident:
    raw = await request.body()
    try:
        station_index, type_code, sev_code, person, lat, lon, ts = _unpack_sos(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    stations = list(db.scalars(select(models.Station)))
    station = stations[station_index] if station_index < len(stations) else stations[0]
    nearest = db.get(models.Personnel, f"pe-{person:02d}") if person else None
    payload = SosRequest(
        station_id=station.id,
        type=TYPE_BY_CODE.get(type_code, "medical"),
        severity=SEV_BY_CODE.get(sev_code, "high"),
        person_id=nearest.id if nearest else None,
        summary=f"Compact SOS packet decoded ({len(raw)} B) at {station.short_name}.",
        lat=lat,
        lon=lon,
    )
    return await raise_sos(payload, db, user)


@router.get("/incidents/{incident_id}/evac-options", response_model=list[EvacRouteOut])
def evac_options(incident_id: str, db: Session = Depends(get_db)) -> list[EvacRouteOut]:
    incident = db.get(models.Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return evacuation.rank_evac_routes(db, incident.station_id)


@router.get("/evac/options", response_model=list[EvacRouteOut])
def evac_options_from(station_id: str, db: Session = Depends(get_db)) -> list[EvacRouteOut]:
    return evacuation.rank_evac_routes(db, station_id)


@router.get("/weather/{station_id}")
def station_weather(station_id: str, db: Session = Depends(get_db)) -> dict:
    station = db.get(models.Station, station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="station not found")
    return {"station_id": station_id, **weather_service.weather_at(station.lat, station.lon, station_id)}


@router.get("/weather/gates/all", response_model=list[WeatherGate])
def weather_gates(db: Session = Depends(get_db)) -> list[WeatherGate]:
    return evacuation.weather_gates(db)


@router.websocket("/ws/incidents")
async def ws_incidents(websocket: WebSocket) -> None:
    await manager.connect("incidents", websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect("incidents", websocket)


@router.websocket("/ws/custody")
async def ws_custody(websocket: WebSocket) -> None:
    await manager.connect("custody", websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect("custody", websocket)
