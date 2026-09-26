"""Tamper-evident custody ledger (SHA-256 hash chain).

Not blockchain by design: each event stores the digest of its predecessor so
editing history is detectable, without the overhead of a distributed ledger.
"""

from __future__ import annotations

import hashlib
from datetime import datetime

GENESIS_HASH = "0" * 64


def canonical(*parts: object) -> str:
    return "|".join("" if p is None else str(p) for p in parts)


def event_hash(prev_hash: str, *parts: object) -> str:
    return hashlib.sha256(f"{prev_hash}|{canonical(*parts)}".encode("utf-8")).hexdigest()


def new_event_hash(
    prev_hash: str,
    consignment_id: str,
    to_state: str,
    ts: datetime,
    station_id: str,
    scanned_by: str,
) -> str:
    return event_hash(prev_hash, consignment_id, to_state, ts.isoformat(), station_id, scanned_by)


def verify_chain(events: list[dict]) -> tuple[bool, str | None]:
    """Return (ok, broken_event_id). `events` must be ordered oldest-first."""
    prev = GENESIS_HASH
    for ev in events:
        ts = ev["ts"]
        ts_key = ts.isoformat() if isinstance(ts, datetime) else ts
        expected = event_hash(
            prev,
            ev["consignment_id"],
            ev["to_state"],
            ts_key,
            ev["station_id"],
            ev["scanned_by"],
        )
        if ev["prev_hash"] != prev or ev["hash"] != expected:
            return False, ev["id"]
        prev = ev["hash"]
    return True, None
