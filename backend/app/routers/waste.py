from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import require_roles
from app.schemas import WasteOut

router = APIRouter(tags=["waste"])

STAGES = ["generated", "segregated", "packed", "loaded", "returned"]


@router.get("/waste", response_model=list[WasteOut])
def list_waste(db: Session = Depends(get_db)) -> list[models.WasteEntry]:
    return list(db.scalars(select(models.WasteEntry)))


@router.post("/waste/{waste_id}/advance", response_model=WasteOut)
def advance_waste(
    waste_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_roles("hq_logistics", "expedition_leader", "station_leader", "inventory_keeper")),
) -> models.WasteEntry:
    entry = db.get(models.WasteEntry, waste_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="waste entry not found")
    idx = STAGES.index(entry.stage) if entry.stage in STAGES else 0
    entry.stage = STAGES[min(idx + 1, len(STAGES) - 1)]
    entry.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/waste/compliance")
def compliance(db: Session = Depends(get_db)) -> dict:
    entries = list(db.scalars(select(models.WasteEntry)))
    total = sum(e.qty_kg for e in entries)
    returned = sum(e.qty_kg for e in entries if e.stage == "returned")
    by_category: dict[str, float] = defaultdict(float)
    by_stage: dict[str, float] = defaultdict(float)
    for e in entries:
        by_category[e.category] += e.qty_kg
        by_stage[e.stage] += e.qty_kg
    return {
        "total_kg": round(total, 1),
        "returned_kg": round(returned, 1),
        "hazardous_kg": round(by_category.get("hazardous", 0.0), 1),
        "compliance_pct": round((returned / total * 100) if total else 0.0, 1),
        "by_category": {k: round(v, 1) for k, v in by_category.items()},
        "by_stage": {k: round(v, 1) for k, v in by_stage.items()},
        "standard": "Protocol on Environmental Protection to the Antarctic Treaty, Annex III",
    }
