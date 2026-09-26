"""Delay anomaly detection on custody dwell times (robust z-score).

The median absolute deviation is used instead of the standard deviation so a
handful of extreme dwells do not mask the signal.
"""

from __future__ import annotations

import statistics

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.schemas import AnomalyRow


def detect(db: Session, threshold: float = 3.5) -> list[AnomalyRow]:
    consignments = {c.id: c for c in db.scalars(select(models.Consignment))}
    events: dict[str, list[models.CustodyEvent]] = {}
    for ev in db.scalars(select(models.CustodyEvent)):
        events.setdefault(ev.consignment_id, []).append(ev)

    dwells: list[tuple[str, float]] = []
    for cid, evs in events.items():
        if len(evs) < 2:
            continue
        evs.sort(key=lambda e: e.ts)
        hours = (evs[-1].ts - evs[0].ts).total_seconds() / 3600
        dwells.append((cid, hours))

    if not dwells:
        return []

    values = np.array([h for _, h in dwells], dtype=float)
    median = float(statistics.median(values))
    mad = float(statistics.median(np.abs(values - median))) or 1.0

    out: list[AnomalyRow] = []
    for cid, hours in dwells:
        z = 0.6745 * (hours - median) / mad
        if z > threshold:
            out.append(
                AnomalyRow(
                    consignment_id=cid,
                    qr_code=consignments[cid].qr_code if cid in consignments else cid,
                    dwell_hours=round(hours, 1),
                    z_score=round(z, 2),
                )
            )
    return sorted(out, key=lambda r: r.z_score, reverse=True)
