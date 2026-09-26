"""What-if season simulator.

A single-scenario discrete replay of a plan plus a Monte Carlo sweep over leg
delay distributions, producing a plan-confidence score.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

import numpy as np

from app import models
from app.services.autonomy import compute_autonomy


def _affected_leg_ids(legs: list[models.Leg], target: models.Leg) -> set[str]:
    affected = {target.id}
    for leg in legs:
        if leg.from_station_id == target.to_station_id or leg.to_station_id == target.to_station_id:
            affected.add(leg.id)
    return affected


def simulate(
    db: Session, target_leg_id: str, delay_days: float, runs: int = 400
) -> dict:
    legs = list(db.scalars(select(models.Leg)))
    target = next((l for l in legs if l.id == target_leg_id), None)
    if target is None:
        raise ValueError("leg not found")

    affected = _affected_leg_ids(legs, target)
    consignments = list(db.scalars(select(models.Consignment)))
    if delay_days <= 0:
        failed: list[dict] = []
    else:
        failed = [
            {
                "consignment_id": c.id,
                "description": c.description,
                "reason": f"{delay_days:g}-day slip on {target.mode} breaks the {c.category} window",
            }
            for c in consignments
            if c.leg_id in affected
        ]

    station_impact: list[dict] = []
    station_ids = {l.to_station_id for l in legs if l.id in affected} | {target.to_station_id}
    if delay_days > 0:
        for sid in station_ids:
            for row in compute_autonomy(db, sid)[:4]:
                if row.risk == "OK" and delay_days < 8:
                    continue
                risk = "CRITICAL" if row.days_left < row.next_resupply_days + delay_days else "WATCH"
                station_impact.append(
                    {
                        "station_id": sid,
                        "item": row.name,
                        "risk": risk,
                        "shortfall_days": max(0.0, delay_days - (row.days_left - row.next_resupply_days)),
                    }
                )

    confidence = max(0.18, min(0.99, 0.94 - delay_days * 0.028 - len(failed) * 0.012))

    # Monte Carlo over a Normal delay distribution centred on the scenario.
    rng = np.random.default_rng(20260 + int(delay_days * 10))
    sd = max(1.0, delay_days * 0.4) if delay_days > 0 else 1.5
    draws = np.clip(rng.normal(loc=delay_days, scale=sd, size=runs), 0, None)
    mc_confidence = float(np.mean(draws < 8) * 100)
    p50 = float(np.percentile(draws, 50))
    p90 = float(np.percentile(draws, 90))

    return {
        "delay_days": delay_days,
        "target_leg_id": target_leg_id,
        "confidence": round(confidence * 100, 1),
        "failed_deliveries": failed,
        "station_impact": station_impact,
        "legs": [
            {"leg_id": l.id, "slipped_days": delay_days if l.id in affected else 0, "missed": delay_days > 0 and l.id in affected}
            for l in legs
        ],
        "monte_carlo": {
            "confidence": round(mc_confidence, 1),
            "p50": round(p50, 1),
            "p90": round(p90, 1),
            "runs": float(runs),
        },
    }
