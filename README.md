# PolarLink

**Integrated Polar Expedition Logistics and Asset Management System** — Smart India Hackathon 2026, problem statement **26062** (Ministry of Earth Sciences / NCPOR).

> Other systems tell you what you have. PolarLink tells you how long each station can survive, what breaks if the ship is late, and the fastest way out in an emergency — even when the internet is down.

An offline-first command centre for expedition planning, cargo chain-of-custody, station inventory, personnel movement and emergency response across Goa → Cape Town → the ice.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui (base-nova, neutral) |
| AI / backend | FastAPI · SQLAlchemy 2 · SQLite (PostgreSQL + PostGIS ready) |
| AI/OR | NumPy Holt-Winters forecasting · Days of Autonomy · Monte Carlo simulator · NetworkX evacuation routing · load optimizer · robust z-score anomalies |

## Modules

- **Command Centre** — live network map, KPIs, Days of Autonomy, alerts, AI copilot.
- **Expeditions & Legs** — season windows, multi-leg timeline, manifests.
- **Cargo & Custody** — QR scan state machine with a SHA-256 hash-chained, tamper-evident ledger.
- **Inventory & Autonomy** — stock as survival time vs. the next resupply window, with forecasting.
- **Personnel & Roll-call** — nomination → de-induction, live muster.
- **Assets & Maintenance** — condition and service schedules.
- **Emergency Response** — SOS, incident lifecycle, international evacuation engine, 19-byte compact SOS packet.
- **What-if Simulator** — delay replay + Monte Carlo confidence score.
- **Madrid Waste Ledger** — reverse cargo tracked to removal.
- **Satellite Sync** — priority lanes (P0/P1/P2), delta sync, byte budget, link-mode throttle.

## Run the frontend

```bash
npm install
npm run dev            # http://localhost:3000
```

The UI ships with a complete synthetic 46-ISEA seed and runs standalone; it does not require the API to demo.

## Run the AI backend (optional but recommended)

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows; use source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs

The Next.js dev server proxies `/api/backend/*` to `http://localhost:8000` (see `next.config.ts`). The sidebar shows whether the AI service is reachable. DB seeds itself on first start (SQLite `backend/polarlink.db`).

Seeded demo logins (password `polar123`): `hq@ncpor.gov.in`, `doctor@ncpor.gov.in`, etc.

## Docker

```bash
docker compose up --build
# web :3000, api :8000, postgres/postgis :5432
```

## Key backend endpoints

```
POST /auth/login                     JWT + RBAC
GET  /stations/{id}/autonomy         Days of Autonomy (forecast vs resupply)
POST /scan/{qr}                      scan state machine + hash-chained custody
GET  /consignments/{id}/verify       tamper detection over the custody chain
POST /sos                            raise SOS (P0 lane)
POST /sos/encode  /sos/compact       19-byte Iridium-SBD-style packet
GET  /incidents/{id}/evac-options    ranked international evacuation routes
POST /simulate/season                what-if replay + Monte Carlo confidence
POST /optimize/load                  aircraft / hold load planner
GET  /anomalies                      delay anomaly detection
POST /sync/push  GET /sync/pull      priority-lane delta sync
```

## Design notes

- **Offline-first edge nodes** with an append-only event log; inventory merges as CRDT-like deltas.
- **Deliberately not blockchain** — a hash chain gives the integrity benefit without the overhead.
- **Synthetic seed now**, schema ready for real cargo lists, stock registers and manifests.
