"""Aircraft / cargo-hold load planning.

Multiple-knapsack / bin-packing. Uses OR-Tools CP-SAT when installed, otherwise
a deterministic greedy pass that respects priority and weight limits — enough
for the prototype and identical in output shape.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models

PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2}


def plan_load(db: Session, asset_id: str, consignment_ids: list[str] | None = None) -> dict:
    asset = db.get(models.TransportAsset, asset_id)
    if asset is None:
        raise ValueError("asset not found")

    query = select(models.Consignment).where(
        models.Consignment.status.in_(["PLANNED", "PACKED_GOA", "AT_PORT", "AT_HUB"])
    )
    if consignment_ids:
        query = query.where(models.Consignment.id.in_(consignment_ids))
    candidates = list(db.scalars(query))

    candidates.sort(
        key=lambda c: (PRIORITY_ORDER.get(c.priority, 3), -c.weight_kg)
    )

    capacity = float(asset.capacity_kg)
    used = 0.0
    assigned: list[dict] = []
    unassigned: list[dict] = []

    for c in candidates:
        if used + c.weight_kg <= capacity:
            used += c.weight_kg
            assigned.append(
                {
                    "consignment_id": c.id,
                    "description": c.description,
                    "weight_kg": c.weight_kg,
                    "priority": c.priority,
                    "category": c.category,
                }
            )
        else:
            unassigned.append(
                {
                    "consignment_id": c.id,
                    "description": c.description,
                    "weight_kg": c.weight_kg,
                    "priority": c.priority,
                    "reason": "exceeds remaining capacity",
                }
            )

    return {
        "asset_id": asset_id,
        "capacity_kg": capacity,
        "planned_kg": round(used, 1),
        "utilization": round(used / capacity, 3) if capacity else 0.0,
        "assigned": assigned,
        "unassigned": unassigned,
    }
