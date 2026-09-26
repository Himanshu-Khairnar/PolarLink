"""Synthetic but realistic NCPOR seed generator.

The problem statement ships no dataset, so PolarLink generates one. The schema
is designed to take in real cargo lists, stock registers and manifests later via
CSV/Excel import adapters.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.hashchain import GENESIS_HASH, new_event_hash
from app.security import hash_password

random.seed(26062)

URLS = {
    "st-hq": ("NCPOR HQ, Vasco da Gama", "NCPOR Goa", "hq", 15.39, 73.81, 400, "Asia/Kolkata", ["Planning", "Procurement", "Packing", "Training", "Cold store"]),
    "st-mum": ("Mumbai Port (JNPT)", "Mumbai Port", "port", 18.95, 72.95, 0, "Asia/Kolkata", ["Berth", "Container yard"]),
    "st-mopa": ("Mopa International Airport", "Mopa (Goa)", "airport", 15.73, 73.86, 0, "Asia/Kolkata", ["IL-76 capable", "Cargo apron"]),
    "st-cpt": ("Cape Town Gateway Hub", "Cape Town", "hub", -33.92, 18.42, 900, "Africa/Johannesburg", ["Bonded warehouse", "Staging", "Local procurement", "Bunker fuel"]),
    "st-maitri": ("Maitri Station, Schirmacher Oasis", "Maitri", "station", -70.76, 11.83, 25, "Antarctica/Syowa", ["Ice runway", "Helipad", "Medical bay", "Workshop", "Fuel farm"]),
    "st-bharati": ("Bharati Station, Larsemann Hills", "Bharati", "station", -69.40, 76.19, 47, "Antarctica/Syowa", ["Quilty Bay jetty", "Medical bay", "Power house", "Incinerator"]),
    "st-himadri": ("Himadri Station, Ny-Alesund", "Himadri", "station", 78.92, 11.93, 18, "Arctic/Longyearbyen", ["Medical room", "Lab", "Svalbard air link"]),
    "st-novo": ("Novolazarevskaya (Novo)", "Novo (RU)", "foreign_station", -70.82, 11.64, 30, "Antarctica/Syowa", ["Ice runway", "Medical bay"]),
    "st-progress": ("Progress Station", "Progress (RU)", "foreign_station", -69.38, 76.39, 20, "Antarctica/Syowa", ["Helipad", "Fuel"]),
    "st-zhongshan": ("Zhongshan Station", "Zhongshan (CN)", "foreign_station", -69.37, 76.37, 25, "Antarctica/Syowa", ["Medical bay", "Helipad", "Runway"]),
    "st-ship": ("MV Vasiliy Golovnin (at sea)", "Ice-class ship", "ship", -42.5, 24.2, 120, "UTC", ["Reefer holds", "Bunker", "Custody scans"]),
}

ASSETS = [
    ("as-ship", "MV Vasiliy Golovnin", "ship", 3_400_000, 40, 14, "in_transit"),
    ("as-il76", "IL-76TD (DROMLAN slot)", "il76", 18_000, 40, 420, "available"),
    ("as-basler", "Basler BT-67", "basler", 3_200, 12, 180, "available"),
    ("as-twin", "Twin Otter", "twin_otter", 1_100, 10, 150, "standby"),
    ("as-heli", "Ka-32 Helicopter", "helicopter", 3_500, 12, 130, "available"),
    ("as-truck1", "Container truck TG-01", "truck", 24_000, 2, None, "available"),
    ("as-truck2", "Container truck TG-02", "truck", 24_000, 2, None, "available"),
]

ITEMS = [
    ("FUEL-DSL", "Diesel (bulk)", "L", "fuel", 2190, True),
    ("FUEL-JETA1", "Jet A1 aviation fuel", "barrel", "fuel", 1460, True),
    ("FUEL-LUB", "Lubricants & hydraulic fluid", "L", "fuel", 1095, False),
    ("FOOD-RATION", "Composite food rations", "pack", "food", 900, True),
    ("FOOD-FLOUR", "Wheat flour", "kg", "food", 240, False),
    ("FOOD-RICE", "Rice", "kg", "food", 720, False),
    ("FOOD-OIL", "Cooking oil", "L", "food", 400, False),
    ("FOOD-FROZEN", "Frozen vegetables", "kg", "food", 300, False),
    ("FOOD-EGG", "Eggs (fresh)", "dozen", "food", 45, False),
    ("MED-INSULIN", "Insulin (cold chain)", "vial", "medical", 540, True),
    ("MED-ANTIBIO", "Broad-spectrum antibiotics", "strip", "medical", 730, True),
    ("MED-VACC", "Emergency vaccines", "dose", "medical", 365, True),
    ("MED-ANALG", "Analgesics", "strip", "medical", 900, False),
    ("MED-BAND", "Surgical dressings", "box", "medical", 1825, False),
    ("MED-O2", "Medical oxygen", "cylinder", "medical", 3650, True),
    ("SPR-GEN", "Generator spare kit", "kit", "spares", 3650, True),
    ("SPR-SAT", "Satellite phone batteries", "unit", "spares", 1460, True),
    ("SPR-PUMP", "Water pump assemblies", "unit", "spares", 3650, False),
    ("SPR-SNOW", "Snowmobile track sets", "set", "spares", 3650, False),
    ("SCI-REAG", "Lab reagents (temperature sensitive)", "kit", "scientific", 365, False),
    ("SCI-SEIS", "Seismic sensor array", "unit", "scientific", 3650, False),
    ("SCI-ICE", "Ice-core drill consumables", "kit", "scientific", 1825, False),
    ("WST-METAL", "Scrap metal (retrograde)", "kg", "waste", 99999, False),
    ("WST-HAZ", "Hazardous waste (retrograde)", "kg", "waste", 99999, False),
]

NAMES = ["Arjun Sharma", "Neha Iyer", "Ravi Verma", "Priya Nair", "Vikram Reddy", "Ananya Menon", "Suresh Patel", "Meera Rao", "Karan Singh", "Divya Joshi", "Rahul Das", "Ishita Kulkarni", "Sanjay Nair", "Pooja Reddy", "Amit Verma", "Sneha Iyer", "Deepak Rao", "Kavya Menon", "Manoj Das", "Ritu Joshi", "Nikhil Sharma", "Tanvi Nair", "Ajay Patel", "Lakshmi Rao"]
ROLES = ["Glaciologist", "Doctor", "Engineer", "Cook", "Meteorologist", "Geophysicist", "Electrician", "Communications", "Logistics", "Biologist", "Mechanic", "Radio Operator"]
BLOOD = ["A+", "B+", "O+", "AB+", "A-", "O-", "B-"]


def _iso(dt: datetime) -> datetime:
    return dt.replace(microsecond=0)


def reset(db: Session) -> None:
    for table in reversed(models.Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()


def seed(db: Session, now: datetime | None = None) -> None:
    now = now or datetime(2026, 9, 26, 6, 0, 0)
    reset(db)

    # Stations & transport
    db.add_all(
        [
            models.Station(
                id=sid, name=v[0], short_name=v[1], type=v[2], lat=v[3], lon=v[4],
                capacity=v[5], tz=v[6], facilities=v[7],
            )
            for sid, v in URLS.items()
        ]
    )
    db.add_all(
        [
            models.TransportAsset(
                id=a[0], name=a[1], type=a[2], capacity_kg=a[3], seats=a[4],
                speed_kts=a[5], status=a[6],
            )
            for a in ASSETS
        ]
    )

    # Expeditions & legs
    ex1 = models.Expedition(id="ex-46", code="46-ISEA", name="46th Indian Scientific Expedition to Antarctica", type="antarctic", season_start=(now + timedelta(days=19)).date(), season_end=(now + timedelta(days=165)).date(), status="planning")
    ex2 = models.Expedition(id="ex-arctic", code="ARCTIC-26", name="Arctic Expedition 2026 (Himadri)", type="arctic", season_start=(now + timedelta(days=5)).date(), season_end=(now + timedelta(days=65)).date(), status="active")
    db.add_all([ex1, ex2])

    leg_rows = [
        ("lg-1", "ex-46", "st-hq", "st-mum", "as-truck1", "Road / container", -14, -12, "arrived"),
        ("lg-2", "ex-46", "st-mum", "st-cpt", "as-ship", "Sea liner", -10, -3, "in_transit"),
        ("lg-3", "ex-46", "st-cpt", "st-bharati", "as-ship", "Ice-class ship", 4, 15, "loading"),
        ("lg-4", "ex-46", "st-mopa", "st-novo", "as-il76", "IL-76 (DROMLAN)", 6, 6, "planned"),
        ("lg-5", "ex-46", "st-novo", "st-maitri", "as-basler", "Basler BT-67", 7, 7, "planned"),
        ("lg-6", "ex-46", "st-bharati", "st-maitri", "as-twin", "Twin Otter", 20, 20, "planned"),
        ("lg-7", "ex-arctic", "st-cpt", "st-himadri", "as-truck2", "Charter (via Oslo)", 2, 4, "planned"),
    ]
    for lid, eid, frm, to, aid, mode, dep, arr, status in leg_rows:
        db.add(
            models.Leg(
                id=lid, expedition_id=eid, from_station_id=frm, to_station_id=to, asset_id=aid,
                mode=mode, planned_depart=_iso(now + timedelta(days=dep)),
                planned_arrive=_iso(now + timedelta(days=arr)), season_only=True, status=status,
            )
        )
    db.flush()

    # Inventory items
    db.add_all(
        [
            models.InventoryItem(id=f"it-{i + 1:02d}", sku=sku, name=name, unit=unit, category=cat, shelf_life_days=life, critical=crit)
            for i, (sku, name, unit, cat, life, crit) in enumerate(ITEMS)
        ]
    )
    db.flush()

    from app.services.forecasting import BASE_USE

    stocked = ["st-maitri", "st-bharati", "st-himadri"]
    cover_cycle = [9, 180, 140, 80, 11, 260, 210, 100, 6]
    for si, sid in enumerate(stocked):
        factor = 1.7 if sid == "st-bharati" else 0.7 if sid == "st-himadri" else 1.0
        for ii, (sku, *_rest) in enumerate(ITEMS):
            if sku.startswith("WST"):
                continue
            per_day = BASE_USE.get(sku, 1.0)
            cover = cover_cycle[(si + ii) % len(cover_cycle)]
            qty = round(per_day * cover * factor * random.uniform(0.55, 1.15), 1)
            shelf = next(it[4] for it in ITEMS if it[0] == sku)
            db.add(
                models.InventoryBatch(
                    id=f"bt-{sid}-{ii:02d}", station_id=sid, item_id=f"it-{ii + 1:02d}",
                    batch=f"B-{2600 + ii * 7 + si}", qty=max(qty, 0.0),
                    min_threshold=round(per_day * 30, 1),
                    expiry_date=(now + timedelta(days=max(shelf - random.randint(30, 400), 20))).date(),
                )
            )

    # Personnel
    for i, name in enumerate(NAMES):
        station = "st-maitri" if i < 9 else "st-bharati" if i < 20 else "st-himadri"
        state = "AT_STATION" if i < 16 else "IN_TRANSIT" if i < 21 else "REPORTED_GOA" if i < 23 else "TRAINED"
        db.add(
            models.Personnel(
                id=f"pe-{i + 1:02d}", name=name, role=ROLES[i % len(ROLES)],
                team="winter" if i % 5 == 0 else "summer",
                medical_clearance=i != 7,
                training=["Firefighting", "Survival", "First aid"] if i % 4 == 0 else ["Survival"],
                blood_group=BLOOD[i % len(BLOOD)],
                emergency_contact=f"+91 98{random.randint(10, 99)}{random.randint(100000, 999999)}",
                station_id=station if state == "AT_STATION" else "st-cpt" if state == "IN_TRANSIT" else None,
                state=state,
            )
        )

    # Ground assets & maintenance
    asset_defs = [
        ("Snowmobile", "Polaris 600", 5), ("Generator", "Cummins 250 kVA", -3),
        ("Generator", "Caterpillar 150 kVA", 40), ("Vehicle", "Arctic truck", 12),
        ("Instrument", "Automatic weather station", -1), ("Instrument", "Magnetometer", 60),
        ("Crane", "Ice-crane", 25), ("Incinerator", "Waste incinerator", 3),
        ("Water plant", "RO desalination unit", 80), ("Snowmobile", "Lynx 6900", 18),
        ("Instrument", "Ionospheric sounder", -6), ("Vehicle", "Pistenbully", 45),
    ]
    conditions = ["good", "good", "fair", "needs_attention", "good", "fair", "down"]
    for i, (atype, aname, due) in enumerate(asset_defs):
        station = stocked[i % len(stocked)]
        db.add(
            models.GroundAsset(
                id=f"ga-{i + 1:02d}", tag=f"NCP-{atype[:3].upper()}-{100 + i}", name=aname, type=atype,
                station_id=station, condition=conditions[i % len(conditions)],
                hours_run=random.randint(400, 24000),
                next_maintenance=(now + timedelta(days=due)).date(),
                last_service=(now - timedelta(days=random.randint(30, 400))).date(),
            )
        )
    db.flush()
    for i in range(6):
        db.add(
            models.MaintenanceLog(
                id=f"ml-{i + 1}", asset_id=f"ga-{i + 1:02d}",
                action=["Oil & filter change", "Belt replacement", "Calibration", "Bearing overhaul", "Software update", "Track alignment"][i],
                by=NAMES[i], ts=_iso(now - timedelta(days=random.randint(3, 60))),
                notes="Completed without issue.",
            )
        )

    # Consignments & custody chain
    cargo = [
        ("Food & provisions pallets", "food", 8400, "st-bharati", "st-hq", "P1"),
        ("Diesel transfer drums", "fuel", 15000, "st-maitri", "st-cpt", "P1"),
        ("Insulin cold-chain box", "medical", 42, "st-bharati", "st-hq", "P0"),
        ("Generator spare kits", "spares", 610, "st-maitri", "st-hq", "P1"),
        ("Seismic sensor array", "scientific", 980, "st-bharati", "st-mum", "P1"),
        ("Emergency vaccine fridge", "medical", 120, "st-maitri", "st-hq", "P0"),
        ("Composite ration packs", "food", 5200, "st-maitri", "st-hq", "P1"),
        ("Ice-core drill consumables", "scientific", 340, "st-bharati", "st-cpt", "P2"),
        ("Medical oxygen cylinders", "medical", 720, "st-bharati", "st-hq", "P0"),
        ("Snowmobile track sets", "spares", 460, "st-maitri", "st-mum", "P1"),
        ("Frozen vegetables (reefer)", "food", 3100, "st-bharati", "st-cpt", "P1"),
        ("Lab reagent kits", "scientific", 95, "st-himadri", "st-hq", "P2"),
        ("Jet A1 barrels", "fuel", 18000, "st-maitri", "st-cpt", "P1"),
        ("Retrograde scrap metal", "waste", 7400, "st-cpt", "st-bharati", "P2"),
        ("Hazardous waste (batteries)", "waste", 380, "st-cpt", "st-maitri", "P2"),
        ("Communications spares", "spares", 210, "st-bharati", "st-hq", "P1"),
    ]
    statuses = ["IN_TRANSIT_TO_PORT", "AT_HUB", "IN_TRANSIT_TO_PORT", "PACKED_GOA", "AT_PORT", "PLANNED", "PACKED_GOA", "AT_HUB", "LOADED", "AT_PORT", "AT_HUB", "PLANNED", "AT_HUB", "OFFLOADED", "LOADED", "IN_TRANSIT_TO_PORT"]
    flow = ["PLANNED", "PACKED_GOA", "IN_TRANSIT_TO_PORT", "AT_PORT", "AT_HUB", "LOADED"]
    state_station = {"PLANNED": "st-hq", "PACKED_GOA": "st-hq", "IN_TRANSIT_TO_PORT": "st-hq", "AT_PORT": "st-mum", "AT_HUB": "st-cpt", "LOADED": "st-ship"}
    actors = ["R. Nair (HQ)", "S. Menon (Store)", "A. Rao (Ship Ops)", "M. Iyer (Store)", "K. Das (HQ)"]

    for i, (desc, cat, weight, dest, origin, priority) in enumerate(cargo):
        cid = f"cs-{i + 1:03d}"
        qr = f"POLAR-46ISEA-{1000 + i}"
        status = statuses[i]
        leg_id = leg_rows[i % len(leg_rows)][0]
        db.add(
            models.Consignment(
                id=cid, qr_code=qr, expedition_id="ex-arctic" if dest == "st-himadri" else "ex-46",
                description=desc, origin_station_id=origin, destination_station_id=dest, category=cat,
                weight_kg=weight, volume_m3=round(weight / 250, 1), priority=priority,
                hazmat_class="Class 3 (flammable liquid)" if cat == "fuel" else None,
                temp_req="2-8 C" if "Insulin" in desc else ("-20 C" if "vaccine" in desc or "Frozen" in desc or "reefer" in desc else None),
                status=status, leg_id=leg_id,
            )
        )
        path = flow[: flow.index(status) + 1] if status in flow else flow
        prev_hash = GENESIS_HASH
        for j, state in enumerate(path):
            sid = state_station.get(state, "st-hq")
            station = URLS[sid]
            # One consignment is seeded with an abnormal dwell so the delay
            # anomaly detector has a real signal to surface in the demo.
            extra_days = 48 if (i == 3 and j == 0) else 0
            ts = _iso(now - timedelta(days=extra_days, hours=(len(path) - 1 - j) * 14))
            actor = actors[(len(path) + j) % len(actors)]
            h = new_event_hash(prev_hash, cid, state, ts, sid, actor)
            db.add(
                models.CustodyEvent(
                    id=f"ce-{cid}-{j}", consignment_id=cid, leg_id=leg_id, station_id=sid,
                    event_type=f"scan:{state.lower()}", from_state="NEW" if j == 0 else path[j - 1],
                    to_state=state, scanned_by=actor, ts=ts,
                    lat=station[3] + random.uniform(-0.01, 0.01), lon=station[4] + random.uniform(-0.01, 0.01),
                    prev_hash=prev_hash, hash=h,
                )
            )
            prev_hash = h

    # Incidents
    incidents = [
        ("in-1", "medical", "critical", "st-bharati", "pe-11", "Crew member with abdominal pain, suspected appendicitis.", "Dr. Menon", "RESPONSE_ACTIVE"),
        ("in-2", "weather", "high", "st-maitri", None, "Katabatic winds above 40 kts, movement restricted.", "Station Leader", "ACKNOWLEDGED"),
        ("in-3", "equipment", "medium", "st-maitri", None, "Primary generator 2 running hot, load shifted to backup.", "Engineer", "ACKNOWLEDGED"),
        ("in-4", "missing_person", "high", "st-himadri", None, "Researcher overdue from field route by 90 minutes.", "Logistics", "MUSTER_COMPLETE"),
        ("in-5", "fire", "low", "st-bharati", None, "Smoke in incinerator flue, extinguished, monitoring.", "Store Keeper", "RESOLVED"),
    ]
    for i, (iid, itype, sev, station, person, summary, by, status) in enumerate(incidents):
        created = _iso(now - timedelta(hours=i * 6 + 3))
        db.add(models.Incident(id=iid, type=itype, severity=sev, station_id=station, person_id=person, summary=summary, reported_by=by, status=status, created_at=created))
        db.add(models.IncidentAction(id=f"ia-{i}-1", incident_id=iid, action="Incident raised and acknowledged.", by=by, ts=created))
        db.add(models.IncidentAction(id=f"ia-{i}-2", incident_id=iid, action="Muster roll-call completed for affected area.", by="HQ Duty Officer", ts=_iso(created + timedelta(hours=2))))

    # Waste ledger
    waste = [
        ("wst-1", "metal", "st-bharati", 7400, "returned"), ("wst-2", "hazardous", "st-maitri", 380, "packed"),
        ("wst-3", "plastic", "st-bharati", 620, "segregated"), ("wst-4", "biological", "st-maitri", 140, "packed"),
        ("wst-5", "paper", "st-himadri", 90, "generated"), ("wst-6", "glass", "st-bharati", 210, "segregated"),
        ("wst-7", "hazardous", "st-bharati", 260, "returned"), ("wst-8", "metal", "st-maitri", 3200, "generated"),
    ]
    for wid, cat, station, qty, stage in waste:
        db.add(models.WasteEntry(id=wid, category=cat, station_id=station, qty_kg=qty, stage=stage, updated_at=_iso(now - timedelta(hours=random.randint(1, 40)))))

    # Sync log
    for i in range(18):
        priority = "P0" if i < 4 else "P1" if i < 12 else "P2"
        entity = ["incident", "inventory_txn", "custody_event", "personnel_move", "photo", "bulk_log"][i % 6]
        size = 74 if priority == "P0" else random.randint(120, 900) if priority == "P1" else random.randint(2000, 48000)
        db.add(
            models.SyncLog(
                id=f"sy-{i + 1}", event_uuid=hashlib.sha256(f"event-{i}".encode()).hexdigest()[:12],
                origin_node=random.choice(["maitri-edge", "bharati-edge", "ship-edge", "himadri-edge"]),
                entity=entity, op=["create", "update", "delta", "append"][i % 4], payload=f"{{{entity}:{i}}}",
                lamport_ts=1200 + i * 3, priority=priority, bytes=size,
                applied_at=_iso(now - timedelta(hours=18 - i)) if i < 15 else None,
            )
        )

    # Users (RBAC demo)
    users = [
        ("u-1", "hq@ncpor.gov.in", "Himanshu Khairnar", "hq_logistics", None),
        ("u-2", "leader@ncpor.gov.in", "Expedition Leader", "expedition_leader", None),
        ("u-3", "maitri@ncpor.gov.in", "Maitri Station Leader", "station_leader", "st-maitri"),
        ("u-4", "store@ncpor.gov.in", "Bharati Store Keeper", "inventory_keeper", "st-bharati"),
        ("u-5", "doctor@ncpor.gov.in", "Bharati Medical Officer", "medical_officer", "st-bharati"),
    ]
    for uid, email, name, role, station in users:
        db.add(models.User(id=uid, email=email, full_name=name, role=role, station_id=station, password_hash=hash_password("polar123")))

    db.commit()


def ensure_seeded(db: Session) -> None:
    count = db.scalar(select(models.Station).limit(1))
    if count is None:
        seed(db)
