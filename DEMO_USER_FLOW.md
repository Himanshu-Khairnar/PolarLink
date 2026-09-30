# PolarLink — Demo User Flow

**Problem statement 26062 · Ministry of Earth Sciences / NCPOR**
Integrated Polar Expedition Logistics and Asset Management System

This is the scripted click-through for a live demo. It runs end-to-end on the
synthetic 46-ISEA seed with **no backend required** (the FastAPI service is a
bonus, not a dependency).

---

## 1. The story we are telling

> One command centre for the expedition chain — Goa → Cape Town → the ice.
> Other systems tell you what you have. PolarLink tells you **how long each
> station can survive, what breaks if the ship is late, and the fastest way out
> in an emergency — even when the internet is down.**

The demo follows a single arc: **a season in motion, then an emergency at
Bharati, then proof the plan can take a hit.** Every module is a station on that
arc, not a standalone feature.

| Beat | Module | Message |
|---|---|---|
| Orient | Command Centre | One live picture of the whole network |
| Plan | Expeditions & Legs | Seasons, legs and manifests are structured, not a spreadsheet |
| Move | Cargo & Custody | Every hand-off is scanned and tamper-evident |
| Survive | Inventory & Autonomy | Stock expressed as survival time vs. resupply |
| People | Personnel & Roll-call | Nomination → muster, accountable to the last person |
| Readiness | Assets & Maintenance | Equipment condition tied to service schedules |
| Respond | Emergency Response | SOS → evacuation routing in seconds |
| Decide | What-if Simulator | Stress-test the plan before the ice does |
| Comply | Madrid Waste Ledger | Reverse cargo tracked to removal |
| Connect | Satellite Sync | Works on a 2.4 kbps link, or fully offline |

**Target length:** 8–12 minutes of clicking + talking. Two "wow" beats:
the **tamper test** and the **offline SOS**.

---

## 2. Pre-flight checklist

Before the judges walk in:

1. `npm install && npm run dev` → open `http://localhost:3000`.
2. Zoom browser to ~90% so the KPI strips and network map fit one screen.
3. Open the sidebar; confirm the footer says **"FastAPI AI service online"**
   (start `uvicorn app.main:app --reload --port 8000` inside `backend/` if you
   want the badge green — it is cosmetic for the demo).
4. Hard-refresh once to guarantee a clean seed. **There is no on-screen reset
   button — refresh the page to reset the demo.** Do this between dry runs.
5. Have the copilot prompts ready (see Scene 11).

**Demo cast / roles.** No login screen — roles are switched live from the topbar
dropdown. Switching a role also snaps the scope:
`hq_logistics` → all stations · `station_leader` → Maitri ·
`inventory_keeper` / `medical_officer` → Bharati · `ship_air_ops` → ship.

**Key seed anchors to reference out loud:**

- Stations: **Maitri**, **Bharati** (47 capacity), **Himadri**, ship
  *MV Vasiliy Golovnin*, plus Novo (RU), Progress (RU), Zhongshan (CN).
- Expeditions: **46-ISEA** (planning, 15 Oct 26 → 10 Mar 27) and **ARCTIC-26**.
- Cargo tags: **`POLAR-46ISEA-1000`** … **`POLAR-46ISEA-1015`**.
- Open incident **in-1**: *medical / critical* at **Bharati** —
  "suspected appendicitis", reported by Dr. Menon.

---

## 3. Scene-by-scene flow

### Scene 1 — Command Centre (orient) · ~60s
Default landing page. **Role: HQ Logistics Officer · Scope: All stations.**

1. Point at the **KPI strip**: *Min autonomy*, *Active consignments*,
   *Legs underway*, *Crew on station*, *Open incidents*, *Pending sync*.
2. Point at the **Live transport network** map (Goa → Mumbai → Cape Town hub →
   ship → Maitri/Bharati/Himadri + partner stations).
3. Point at **Days of Autonomy** bars — "this is survival time vs. the next
   resupply window, not just stock on a shelf."
4. Point at the **Station risk board** and **Live custody feed** (hash-chained
   scans).

> Say: "Every other screen you'll see next rolls up into this one."

---

### Scene 2 — Expeditions & Legs (plan) · ~50s
Sidebar → **Expeditions & Legs**. Tab: **46-ISEA**.

1. Show the **season window** stat and the **Gantt timeline** with the TODAY
   marker.
2. Point out the **legs** below (sea liner, ice-class ship, IL-76, Basler,
   Twin Otter, helicopter).
3. On any leg, click **Manifest** → show **Personnel** and **Cargo** on that
   leg with weights.

> Optional flex: click **New expedition** or **Add leg** to prove the plan is
> editable, then close without committing.

---

### Scene 3 — Cargo & Custody (move) + ⭐ tamper test · ~2 min
Sidebar → **Cargo & Custody**.

1. Keep category tab on **all**. Point at the register: QR tag, route, weight,
   status.
2. Click **`POLAR-46ISEA-1002` · "Insulin cold-chain box"** (P0, temp 2–8 C,
   route Goa → Bharati). The custody dialog opens.
3. Show the **Lifecycle** stage flow and the QR tag panel.
4. Under **Custody ledger**, click **Verify** → "Chain intact — every event
   hashes to its predecessor."
5. Click **Tamper test** → toast *"Custody record edited out-of-band"*, then
   click **Verify** again → "Chain broken at …".
6. Click **Scan → …** to advance the consignment one state. Watch it append a
   new hash-chained event.

> Say: "We are deliberately **not** blockchain — a SHA-256 hash chain gives the
> same tamper evidence with none of the overhead. Here, watch a record get
> edited after signing; verification catches it instantly."

> This is the flagship integrity demo. Pause on it.

---

### Scene 4 — Inventory & Days of Autonomy (survive) · ~90s
Sidebar → **Inventory & Days of Autonomy**. Station tab: **Bharati**.

1. Show **Lowest autonomy**, **Critical lines**, **Watch lines**,
   **Next resupply** KPIs.
2. In the stock table, find a **critical** line and click **Forecast**.
3. Show the **Holt-Winters chart**: actual vs. forecast vs. 30-day safety line.
4. In **Log a stock transaction**, set reason **Consumed**, apply it, and show
   **New projected cover ≈ N days** drop.

> Say: "Days of Autonomy = current stock ÷ forecast daily use, measured against
> the next feasible resupply. Deltas merge commutatively, so two offline nodes
> can reconcile inventory without conflict."

Then switch the station tab to **Maitri** to show per-station independence.

---

### Scene 5 — Personnel & Roll-call (people) · ~70s
Sidebar → **Personnel & Roll-call**.

1. Show the roster; filter tabs **All / Summer / Winter-over / stations**.
2. Point at the **Medical flags** KPI and the red shield on the unchecked member.
3. Click any name → the detail dialog (state, location, clearance, blood group,
   emergency contact, training).
4. In **Muster roll-call** (right panel): choose **Bharati**, search a name,
   tick people present, or hit **All present**.
5. Click **Complete roll-call**.

> Say: "If anyone is unaccounted for at completion, PolarLink raises a
> missing-person incident automatically." (Leave one unticked to demonstrate —
> it creates the incident — or tick all for a clean close. Choose based on time.)

---

### Scene 6 — Assets & Maintenance (readiness) · ~40s
Sidebar → **Assets & Maintenance**.

1. Click the **Needs attention** stat to filter to `down` /
   `needs_attention` assets, then **Service due ≤ 7d**.
2. On an asset card, click **Log service** → confirm the toast and that the
   schedule resets to good/90 days.

> Say: "Condition and hours-run feed a service schedule, so readiness is a
> dashboard, not a clipboard."

---

### Scene 7 — Emergency Response (respond) · ~2 min
Sidebar → **Emergency Response**.

1. Point at **Incident command** row **in-1** (medical, critical, Bharati);
   expand it → show the **StageFlow** and action log.
2. Click **Advance → …** once to move the incident forward.
3. Scroll to **International evacuation engine**. Set **From** = **Maitri**.
4. Click the top-ranked route → the **network map highlights the hops** and the
   row shows hours, transfers, weather-ok %, medical gap, feasibility.
5. Point at the **Compact SOS packet** panel: **19 bytes**, one Iridium SBD
   message, field breakdown.

> Say: "Raise SOS opens an incident, triggers the muster roll-call, and
> generates ranked evacuation options ranked by time, weather gate, transfers
> and medical capability at the destination."

---

### Scene 8 — What-if Simulator (decide) · ~70s
Sidebar → **What-if Simulator**.

1. Pick a **leg to perturb** (e.g. the ship leg).
2. Drag **Delay** to **12 days**. Click **Run simulation**.
3. Show **Plan confidence** drop on the semicircle meter, plus
   **Deliveries at risk**, **Stations impacted**, **Legs slipping**.
4. Walk the result cards: *Deliveries that miss their window*, *Station impact*
   (cover shortfall), **Monte Carlo season** (P50/P90 delay + histogram).

> Say: "This is our Smart-Automation differentiator — the platform doesn't just
> record the plan, it stress-tests it before the ice does."

---

### Scene 9 — Madrid Waste Ledger (comply) · ~40s
Sidebar → **Madrid Protocol Waste Ledger**.

1. Show the **reverse-cargo pipeline** (generated → segregated → packed →
   loaded → returned) as a kanban.
2. Click **Advance** on a waste card to move it a stage.
3. Show the **Return compliance** donut and the **Category mix** bars.

> Say: "Waste is reverse cargo with its own provable custody chain — exactly
> what Annex III / CAG audit needs."

---

### Scene 10 — Satellite Sync (connect) + ⭐ offline demo · ~90s
Sidebar → **Satellite Sync**.

1. Show **Priority lanes** (P0 SOS/medical · P1 inventory/custody · P2 bulk).
2. Use the topbar link switcher to set **Offline**.
3. Go back to **Cargo**, scan a consignment, or raise an SOS in **Emergency**.
   The toast says it is **queued locally**; the dashboard **Pending sync** count
   climbs.
4. Return to **Satellite Sync**, set link to **2.4 kbps (throttled)**, set a
   small **byte budget**, and click **Flush lanes**. P0 drains first.

> Say: "On a 2.4 kbps link, a 19-byte SOS goes instantly while bulk photos
> queue behind it. Fully offline, the node just keeps writing to its local event
> log."

> This is the second wow beat: it directly answers the "internet is down"
> requirement.

---

### Scene 11 — AI copilot (any time) · ~30s
Click the **floating chat button** (bottom-right). Try, in order:

- "What is critical at Bharati?"
- "Where is POLAR-46ISEA-1002?"
- "Evacuation options from Maitri"
- "What if the ship is delayed 12 days?"

> Say: "Answers are generated from the live plan, not a canned script."

---

### Scene 12 — Role-based access (close) · ~20s
Topbar → **role dropdown**. Switch from **HQ Logistics Officer** to
**Station Leader**.

1. Note the **scope chip** snap to **Maitri**.
2. Note the alert badge / incident counts are scoped accordingly.

> Say: "Same system, scoped to the role and the station. HQ sees the network;
> a station leader sees their own patch."

---

## 4. Short version (if you only have 5 minutes)

Command Centre → Cargo & Custody (tamper test + scan) → Emergency
(evac routes + 19-byte packet) → What-if Simulator (12-day delay) → Satellite
Sync (offline → P0 flush). That hits the four judged pillars: **integrity,
response, foresight, offline resilience.**

---

## 5. Recovery / gotchas

- **Something looks mutated from a dry run:** refresh the page — the seed
  regenerates from scratch. No reset button exists in the UI.
- **Backend badge red:** cosmetic. The whole demo runs on the frontend engine;
  do not burn demo time debugging it.
- **Toasts stack up:** they auto-dismiss; give them a beat before moving on.
- **Don't over-click the copilot in Scene 11** — three prompts is enough.
- **Times assume one presenter.** Split talking and clicking across two people
  only if rehearsed.

---

## 6. Closing line

> "PolarLink turns a fragile spreadsheet-and-radio workflow into an
> offline-first command centre: provable custody, survival-time inventory,
> ranked evacuation, and a season plan that is stress-tested before it ships."
