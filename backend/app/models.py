"""SQLAlchemy models mirroring the PolarLink data model (PDF section 8)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    short_name: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(24))  # station | ship | hub | port | foreign_station | airport | hq
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    tz: Mapped[str] = mapped_column(String(48), default="UTC")
    facilities: Mapped[list] = mapped_column(JSON, default=list)


class TransportAsset(Base):
    __tablename__ = "transport_assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(24))
    capacity_kg: Mapped[float] = mapped_column(Float, default=0)
    seats: Mapped[int] = mapped_column(Integer, default=0)
    speed_kts: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="available")


class Expedition(Base):
    __tablename__ = "expeditions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(24))
    season_start: Mapped[date] = mapped_column(Date)
    season_end: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24), default="planning")

    legs: Mapped[list["Leg"]] = relationship(back_populates="expedition")


class Leg(Base):
    __tablename__ = "legs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    expedition_id: Mapped[str] = mapped_column(ForeignKey("expeditions.id"))
    from_station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    to_station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    asset_id: Mapped[str] = mapped_column(ForeignKey("transport_assets.id"))
    mode: Mapped[str] = mapped_column(String(64))
    planned_depart: Mapped[datetime] = mapped_column(DateTime)
    planned_arrive: Mapped[datetime] = mapped_column(DateTime)
    actual_depart: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_arrive: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    season_only: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(24), default="planned")

    expedition: Mapped[Expedition] = relationship(back_populates="legs")


class Consignment(Base):
    __tablename__ = "consignments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    qr_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expedition_id: Mapped[str] = mapped_column(ForeignKey("expeditions.id"))
    description: Mapped[str] = mapped_column(String(200))
    origin_station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    destination_station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    category: Mapped[str] = mapped_column(String(24))
    weight_kg: Mapped[float] = mapped_column(Float, default=0)
    volume_m3: Mapped[float] = mapped_column(Float, default=0)
    priority: Mapped[str] = mapped_column(String(4), default="P1")
    hazmat_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    temp_req: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PLANNED")
    leg_id: Mapped[str | None] = mapped_column(ForeignKey("legs.id"), nullable=True)


class CustodyEvent(Base):
    __tablename__ = "custody_events"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    consignment_id: Mapped[str] = mapped_column(ForeignKey("consignments.id"), index=True)
    leg_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    station_id: Mapped[str] = mapped_column(String(32))
    event_type: Mapped[str] = mapped_column(String(64))
    from_state: Mapped[str] = mapped_column(String(32))
    to_state: Mapped[str] = mapped_column(String(32))
    scanned_by: Mapped[str] = mapped_column(String(120))
    ts: Mapped[datetime] = mapped_column(DateTime)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    sku: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    unit: Mapped[str] = mapped_column(String(24))
    category: Mapped[str] = mapped_column(String(24))
    shelf_life_days: Mapped[int] = mapped_column(Integer, default=3650)
    critical: Mapped[bool] = mapped_column(Boolean, default=False)


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    item_id: Mapped[str] = mapped_column(ForeignKey("inventory_items.id"))
    batch: Mapped[str] = mapped_column(String(32))
    qty: Mapped[float] = mapped_column(Float, default=0)
    min_threshold: Mapped[float] = mapped_column(Float, default=0)
    expiry_date: Mapped[date] = mapped_column(Date)


class InventoryTxn(Base):
    __tablename__ = "inventory_txn"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    item_id: Mapped[str] = mapped_column(ForeignKey("inventory_items.id"))
    delta: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(24))
    actor: Mapped[str] = mapped_column(String(120), default="edge")
    ts: Mapped[datetime] = mapped_column(DateTime)
    origin_node: Mapped[str] = mapped_column(String(48), default="hq-node")
    event_uuid: Mapped[str] = mapped_column(String(64), default="")
    lamport_ts: Mapped[int] = mapped_column(Integer, default=0)


class Personnel(Base):
    __tablename__ = "personnel"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(80))
    team: Mapped[str] = mapped_column(String(12))
    medical_clearance: Mapped[bool] = mapped_column(Boolean, default=False)
    training: Mapped[list] = mapped_column(JSON, default=list)
    blood_group: Mapped[str] = mapped_column(String(8))
    emergency_contact: Mapped[str] = mapped_column(String(64))
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.id"), nullable=True)
    state: Mapped[str] = mapped_column(String(24), default="NOMINATED")


class GroundAsset(Base):
    __tablename__ = "ground_assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tag: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(48))
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    condition: Mapped[str] = mapped_column(String(24), default="good")
    hours_run: Mapped[int] = mapped_column(Integer, default=0)
    next_maintenance: Mapped[date] = mapped_column(Date)
    last_service: Mapped[date | None] = mapped_column(Date, nullable=True)


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("ground_assets.id"))
    action: Mapped[str] = mapped_column(String(120))
    by: Mapped[str] = mapped_column(String(120))
    ts: Mapped[datetime] = mapped_column(DateTime)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    type: Mapped[str] = mapped_column(String(24))
    severity: Mapped[str] = mapped_column(String(16))
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    person_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    reported_by: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(24), default="RAISED")
    created_at: Mapped[datetime] = mapped_column(DateTime)


class IncidentAction(Base):
    __tablename__ = "incident_actions"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"))
    action: Mapped[str] = mapped_column(Text)
    by: Mapped[str] = mapped_column(String(120))
    ts: Mapped[datetime] = mapped_column(DateTime)


class SyncLog(Base):
    __tablename__ = "sync_log"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    event_uuid: Mapped[str] = mapped_column(String(64), index=True)
    origin_node: Mapped[str] = mapped_column(String(48))
    entity: Mapped[str] = mapped_column(String(48))
    op: Mapped[str] = mapped_column(String(16))
    payload: Mapped[str] = mapped_column(Text)
    lamport_ts: Mapped[int] = mapped_column(Integer, index=True)
    priority: Mapped[str] = mapped_column(String(4), default="P1")
    bytes: Mapped[int] = mapped_column(Integer, default=0)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class WasteEntry(Base):
    __tablename__ = "waste_entries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    category: Mapped[str] = mapped_column(String(24))
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"))
    qty_kg: Mapped[float] = mapped_column(Float, default=0)
    stage: Mapped[str] = mapped_column(String(24), default="generated")
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32))
    station_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(256))
