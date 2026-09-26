from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ORM = ConfigDict(from_attributes=True)


# ----------------------------- auth -----------------------------
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class UserOut(BaseModel):
    model_config = ORM
    id: str
    email: str
    full_name: str
    role: str
    station_id: str | None = None


# ----------------------------- planning -----------------------------
class StationOut(BaseModel):
    model_config = ORM
    id: str
    name: str
    short_name: str
    type: str
    lat: float
    lon: float
    capacity: int
    tz: str
    facilities: list[str] = Field(default_factory=list)


class LegOut(BaseModel):
    model_config = ORM
    id: str
    expedition_id: str
    from_station_id: str
    to_station_id: str
    asset_id: str
    mode: str
    planned_depart: datetime
    planned_arrive: datetime
    status: str
    season_only: bool


class ExpeditionOut(BaseModel):
    model_config = ORM
    id: str
    code: str
    name: str
    type: str
    season_start: date
    season_end: date
    status: str
    legs: list[LegOut] = Field(default_factory=list)


# ----------------------------- cargo -----------------------------
class ConsignmentOut(BaseModel):
    model_config = ORM
    id: str
    qr_code: str
    expedition_id: str
    description: str
    origin_station_id: str
    destination_station_id: str
    category: str
    weight_kg: float
    volume_m3: float
    priority: str
    hazmat_class: str | None = None
    temp_req: str | None = None
    status: str
    leg_id: str | None = None


class CustodyEventOut(BaseModel):
    model_config = ORM
    id: str
    consignment_id: str
    station_id: str
    event_type: str
    from_state: str
    to_state: str
    scanned_by: str
    ts: datetime
    lat: float
    lon: float
    prev_hash: str
    hash: str


class ScanRequest(BaseModel):
    qr_code: str
    to_state: str | None = None
    station_id: str | None = None
    scanned_by: str = "field-scan"
    lat: float | None = None
    lon: float | None = None


class ScanResponse(BaseModel):
    consignment: ConsignmentOut
    event: CustodyEventOut
    priority: str
    accepted: bool = True


class VerifyResponse(BaseModel):
    consignment_id: str
    ok: bool
    broken_at: str | None = None
    events: int


# ----------------------------- inventory -----------------------------
class InventoryItemOut(BaseModel):
    model_config = ORM
    id: str
    sku: str
    name: str
    unit: str
    category: str
    shelf_life_days: int
    critical: bool


class InventoryBatchOut(BaseModel):
    model_config = ORM
    id: str
    station_id: str
    item_id: str
    batch: str
    qty: float
    min_threshold: float
    expiry_date: date


class TxnRequest(BaseModel):
    station_id: str
    item_id: str
    delta: float
    reason: Literal["received", "consumed", "transfer", "wastage", "count_adj"]
    actor: str = "edge"
    origin_node: str | None = None


class TxnOut(BaseModel):
    model_config = ORM
    id: str
    station_id: str
    item_id: str
    delta: float
    reason: str
    actor: str
    ts: datetime
    origin_node: str


class AutonomyRow(BaseModel):
    item_id: str
    name: str
    unit: str
    category: str
    critical: bool
    stock: float
    daily_use: float
    days_left: int
    next_resupply_days: int
    risk: Literal["CRITICAL", "WATCH", "OK"]


class ForecastPoint(BaseModel):
    day: int
    value: float


class ForecastResponse(BaseModel):
    station_id: str
    item_id: str
    method: str
    history: list[float]
    forecast: list[ForecastPoint]


# ----------------------------- personnel -----------------------------
class PersonnelOut(BaseModel):
    model_config = ORM
    id: str
    name: str
    role: str
    team: str
    medical_clearance: bool
    training: list[str] = Field(default_factory=list)
    blood_group: str
    emergency_contact: str
    station_id: str | None = None
    state: str


class RollCallOut(BaseModel):
    station_id: str
    accounted: list[str]
    unaccounted: list[str]
    total: int


class MovementRequest(BaseModel):
    person_id: str
    leg_id: str | None = None
    status: str


# ----------------------------- assets -----------------------------
class AssetOut(BaseModel):
    model_config = ORM
    id: str
    tag: str
    name: str
    type: str
    station_id: str
    condition: str
    hours_run: int
    next_maintenance: date
    last_service: date | None = None


class MaintenanceRequest(BaseModel):
    action: str
    by: str = "HQ Logistics Officer"
    notes: str | None = None


# ----------------------------- emergency -----------------------------
class SosRequest(BaseModel):
    station_id: str
    type: Literal["medical", "fire", "missing_person", "equipment", "weather"]
    severity: Literal["low", "medium", "high", "critical"]
    summary: str
    person_id: str | None = None
    reported_by: str = "edge-node"
    lat: float | None = None
    lon: float | None = None


class IncidentOut(BaseModel):
    model_config = ORM
    id: str
    type: str
    severity: str
    station_id: str
    person_id: str | None = None
    summary: str
    reported_by: str
    status: str
    created_at: datetime


class IncidentAdvance(BaseModel):
    status: str
    action: str
    by: str = "HQ Duty Officer"


class EvacRouteOut(BaseModel):
    id: str
    label: str
    hops: list[str]
    total_hours: float
    weather_ok_prob: float
    transfers: int
    medical_gap: int
    feasible: bool
    score: float


class WeatherGate(BaseModel):
    from_station: str
    to_station: str
    mode: str
    weather_ok_prob: float
    season_ok: bool


# ----------------------------- simulation / AI -----------------------------
class SimulateRequest(BaseModel):
    target_leg_id: str
    delay_days: float = Field(ge=0, le=60)
    runs: int = Field(default=400, ge=50, le=5000)


class SimulateResponse(BaseModel):
    delay_days: float
    target_leg_id: str
    confidence: float
    failed_deliveries: list[dict[str, Any]]
    station_impact: list[dict[str, Any]]
    legs: list[dict[str, Any]]
    monte_carlo: dict[str, float]


class LoadOptimizeRequest(BaseModel):
    asset_id: str
    consignment_ids: list[str] | None = None


class LoadPlan(BaseModel):
    asset_id: str
    capacity_kg: float
    planned_kg: float
    utilization: float
    assigned: list[dict[str, Any]]
    unassigned: list[dict[str, Any]]


class AnomalyRow(BaseModel):
    consignment_id: str
    qr_code: str
    dwell_hours: float
    z_score: float


# ----------------------------- sync -----------------------------
class SyncEventIn(BaseModel):
    event_uuid: str = Field(max_length=64)
    origin_node: str = Field(max_length=48)
    entity: str = Field(max_length=48)
    op: Literal["create", "update", "delta", "append"]
    payload: str = Field(max_length=8000)
    lamport_ts: int
    priority: Literal["P0", "P1", "P2"] = "P1"
    bytes: int = 0


class SyncPushResponse(BaseModel):
    accepted: int
    duplicates: int
    applied_at: datetime


class SyncEventOut(BaseModel):
    model_config = ORM
    id: str
    event_uuid: str
    origin_node: str
    entity: str
    op: str
    payload: str
    lamport_ts: int
    priority: str
    bytes: int
    applied_at: datetime | None = None


# ----------------------------- waste -----------------------------
class WasteOut(BaseModel):
    model_config = ORM
    id: str
    category: str
    station_id: str
    qty_kg: float
    stage: str
    updated_at: datetime
