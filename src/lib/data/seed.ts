import {
  type Alert,
  type Asset,
  type Consignment,
  type CustodyEvent,
  type Expedition,
  type ID,
  type Incident,
  type IncidentAction,
  type InventoryBatch,
  type InventoryItem,
  type InventoryTxn,
  type Leg,
  type MaintenanceLog,
  type Personnel,
  type Station,
  type SyncEvent,
  type TransportAsset,
  type WasteEntry,
} from "@/lib/types";
import { digest, GENESIS_HASH } from "@/lib/hash";

/** Small deterministic PRNG so the seeded demo is stable across reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(26062);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

export const TODAY = new Date("2026-09-26T06:00:00.000Z");
const iso = (d: Date) => d.toISOString();
const daysFrom = (base: Date, days: number) =>
  iso(new Date(base.getTime() + days * 86400000));
const hoursFrom = (base: Date, hours: number) =>
  iso(new Date(base.getTime() + hours * 3600000));

export interface Dataset {
  stations: Station[];
  assets: TransportAsset[];
  expeditions: Expedition[];
  legs: Leg[];
  items: InventoryItem[];
  batches: InventoryBatch[];
  personnel: Personnel[];
  groundAssets: Asset[];
  consignments: Consignment[];
  custody: CustodyEvent[];
  txns: InventoryTxn[];
  incidents: Incident[];
  incidentActions: IncidentAction[];
  maintenance: MaintenanceLog[];
  waste: WasteEntry[];
  syncLog: SyncEvent[];
  alerts: Alert[];
}

const stations: Station[] = [
  { id: "st-hq", name: "NCPOR HQ, Vasco da Gama", shortName: "NCPOR Goa", type: "hq", lat: 15.39, lon: 73.81, capacity: 400, tz: "Asia/Kolkata", facilities: ["Planning", "Procurement", "Packing", "Training", "Cold store"] },
  { id: "st-mum", name: "Mumbai Port (JNPT)", shortName: "Mumbai Port", type: "port", lat: 18.95, lon: 72.95, capacity: 0, tz: "Asia/Kolkata", facilities: ["Berth", "Container yard"] },
  { id: "st-mopa", name: "Mopa International Airport", shortName: "Mopa (Goa)", type: "airport", lat: 15.73, lon: 73.86, capacity: 0, tz: "Asia/Kolkata", facilities: ["IL-76 capable", "Cargo apron"] },
  { id: "st-cpt", name: "Cape Town Gateway Hub", shortName: "Cape Town", type: "hub", lat: -33.92, lon: 18.42, capacity: 900, tz: "Africa/Johannesburg", facilities: ["Bonded warehouse", "Staging", "Local procurement", "Bunker fuel"] },
  { id: "st-maitri", name: "Maitri Station, Schirmacher Oasis", shortName: "Maitri", type: "station", lat: -70.76, lon: 11.83, capacity: 25, tz: "Antarctica/Syowa", facilities: ["Ice runway", "Helipad", "Medical bay", "Workshop", "Fuel farm"] },
  { id: "st-bharati", name: "Bharati Station, Larsemann Hills", shortName: "Bharati", type: "station", lat: -69.4, lon: 76.19, capacity: 47, tz: "Antarctica/Syowa", facilities: ["Quilty Bay jetty", "Medical bay", "Power house", "Incinerator"] },
  { id: "st-himadri", name: "Himadri Station, Ny-Alesund", shortName: "Himadri", type: "station", lat: 78.92, lon: 11.93, capacity: 18, tz: "Arctic/Longyearbyen", facilities: ["Medical room", "Lab", "Svalbard air link"] },
  { id: "st-novo", name: "Novolazarevskaya (Novo)", shortName: "Novo (RU)", type: "foreign_station", lat: -70.82, lon: 11.64, capacity: 30, tz: "Antarctica/Syowa", facilities: ["Ice runway", "Medical bay", "Snow runway"] },
  { id: "st-progress", name: "Progress Station", shortName: "Progress (RU)", type: "foreign_station", lat: -69.38, lon: 76.39, capacity: 20, tz: "Antarctica/Syowa", facilities: ["Helipad", "Fuel"] },
  { id: "st-zhongshan", name: "Zhongshan Station", shortName: "Zhongshan (CN)", type: "foreign_station", lat: -69.37, lon: 76.37, capacity: 25, tz: "Antarctica/Syowa", facilities: ["Medical bay", "Helipad", "Runway"] },
  { id: "st-ship", name: "MV Vasiliy Golovnin (at sea)", shortName: "Ice-class ship", type: "ship", lat: -42.5, lon: 24.2, capacity: 120, tz: "UTC", facilities: ["Reefer holds", "Bunker", "Custody scans"] },
];

const assets: TransportAsset[] = [
  { id: "as-ship", name: "MV Vasiliy Golovnin", type: "ship", capacityKg: 3_400_000, seats: 40, speedKts: 14, status: "in_transit" },
  { id: "as-il76", name: "IL-76TD (DROMLAN slot)", type: "il76", capacityKg: 18_000, seats: 40, speedKts: 420, status: "available" },
  { id: "as-basler", name: "Basler BT-67", type: "basler", capacityKg: 3_200, seats: 12, speedKts: 180, status: "available" },
  { id: "as-twin", name: "Twin Otter", type: "twin_otter", capacityKg: 1_100, seats: 10, speedKts: 150, status: "standby" },
  { id: "as-heli", name: "Ka-32 Helicopter", type: "helicopter", capacityKg: 3_500, seats: 12, speedKts: 130, status: "available" },
  { id: "as-truck1", name: "Container truck TG-01", type: "truck", capacityKg: 24_000, seats: 2, status: "available" },
  { id: "as-truck2", name: "Container truck TG-02", type: "truck", capacityKg: 24_000, seats: 2, status: "available" },
];

const expeditions: Expedition[] = [
  { id: "ex-46", code: "46-ISEA", name: "46th Indian Scientific Expedition to Antarctica", type: "antarctic", seasonStart: "2026-10-15", seasonEnd: "2027-03-10", status: "planning" },
  { id: "ex-arctic", code: "ARCTIC-26", name: "Arctic Expedition 2026 (Himadri)", type: "arctic", seasonStart: "2026-10-01", seasonEnd: "2026-11-30", status: "active" },
];

const legs: Leg[] = [
  { id: "lg-1", expeditionId: "ex-46", fromStationId: "st-hq", toStationId: "st-mum", assetId: "as-truck1", mode: "Road / container", plannedDepart: daysFrom(TODAY, -14), plannedArrive: daysFrom(TODAY, -12), actualDepart: daysFrom(TODAY, -14), actualArrive: daysFrom(TODAY, -12), seasonOnly: false, status: "arrived" },
  { id: "lg-2", expeditionId: "ex-46", fromStationId: "st-mum", toStationId: "st-cpt", assetId: "as-ship", mode: "Sea liner", plannedDepart: daysFrom(TODAY, -10), plannedArrive: daysFrom(TODAY, -3), seasonOnly: true, status: "in_transit" },
  { id: "lg-3", expeditionId: "ex-46", fromStationId: "st-cpt", toStationId: "st-bharati", assetId: "as-ship", mode: "Ice-class ship", plannedDepart: daysFrom(TODAY, 4), plannedArrive: daysFrom(TODAY, 15), seasonOnly: true, status: "loading" },
  { id: "lg-4", expeditionId: "ex-46", fromStationId: "st-mopa", toStationId: "st-novo", assetId: "as-il76", mode: "IL-76 (DROMLAN)", plannedDepart: daysFrom(TODAY, 6), plannedArrive: daysFrom(TODAY, 6), seasonOnly: true, status: "planned" },
  { id: "lg-5", expeditionId: "ex-46", fromStationId: "st-novo", toStationId: "st-maitri", assetId: "as-basler", mode: "Basler BT-67", plannedDepart: daysFrom(TODAY, 7), plannedArrive: daysFrom(TODAY, 7), seasonOnly: true, status: "planned" },
  { id: "lg-6", expeditionId: "ex-46", fromStationId: "st-bharati", toStationId: "st-maitri", assetId: "as-twin", mode: "Twin Otter", plannedDepart: daysFrom(TODAY, 20), plannedArrive: daysFrom(TODAY, 20), seasonOnly: true, status: "planned" },
  { id: "lg-7", expeditionId: "ex-arctic", fromStationId: "st-cpt", toStationId: "st-himadri", assetId: "as-truck2", mode: "Charter (via Oslo)", plannedDepart: daysFrom(TODAY, 2), plannedArrive: daysFrom(TODAY, 4), seasonOnly: true, status: "planned" },
];

const itemDefs: Omit<InventoryItem, "id">[] = [
  { sku: "FUEL-DSL", name: "Diesel (bulk)", unit: "L", category: "fuel", shelfLifeDays: 2190, critical: true },
  { sku: "FUEL-JETA1", name: "Jet A1 aviation fuel", unit: "barrel", category: "fuel", shelfLifeDays: 1460, critical: true },
  { sku: "FUEL-LUB", name: "Lubricants & hydraulic fluid", unit: "L", category: "fuel", shelfLifeDays: 1095, critical: false },
  { sku: "FOOD-RATION", name: "Composite food rations", unit: "pack", category: "food", shelfLifeDays: 900, critical: true },
  { sku: "FOOD-FLOUR", name: "Wheat flour", unit: "kg", category: "food", shelfLifeDays: 240, critical: false },
  { sku: "FOOD-RICE", name: "Rice", unit: "kg", category: "food", shelfLifeDays: 720, critical: false },
  { sku: "FOOD-OIL", name: "Cooking oil", unit: "L", category: "food", shelfLifeDays: 400, critical: false },
  { sku: "FOOD-FROZEN", name: "Frozen vegetables", unit: "kg", category: "food", shelfLifeDays: 300, critical: false },
  { sku: "FOOD-EGG", name: "Eggs (fresh)", unit: "dozen", category: "food", shelfLifeDays: 45, critical: false },
  { sku: "MED-INSULIN", name: "Insulin (cold chain)", unit: "vial", category: "medical", shelfLifeDays: 540, critical: true },
  { sku: "MED-ANTIBIO", name: "Broad-spectrum antibiotics", unit: "strip", category: "medical", shelfLifeDays: 730, critical: true },
  { sku: "MED-VACC", name: "Emergency vaccines", unit: "dose", category: "medical", shelfLifeDays: 365, critical: true },
  { sku: "MED-ANALG", name: "Analgesics", unit: "strip", category: "medical", shelfLifeDays: 900, critical: false },
  { sku: "MED-BAND", name: "Surgical dressings", unit: "box", category: "medical", shelfLifeDays: 1825, critical: false },
  { sku: "MED-O2", name: "Medical oxygen", unit: "cylinder", category: "medical", shelfLifeDays: 3650, critical: true },
  { sku: "SPR-GEN", name: "Generator spare kit", unit: "kit", category: "spares", shelfLifeDays: 3650, critical: true },
  { sku: "SPR-SAT", name: "Satellite phone batteries", unit: "unit", category: "spares", shelfLifeDays: 1460, critical: true },
  { sku: "SPR-PUMP", name: "Water pump assemblies", unit: "unit", category: "spares", shelfLifeDays: 3650, critical: false },
  { sku: "SPR-SNOW", name: "Snowmobile track sets", unit: "set", category: "spares", shelfLifeDays: 3650, critical: false },
  { sku: "SCI-REAG", name: "Lab reagents (temperature sensitive)", unit: "kit", category: "scientific", shelfLifeDays: 365, critical: false },
  { sku: "SCI-SEIS", name: "Seismic sensor array", unit: "unit", category: "scientific", shelfLifeDays: 3650, critical: false },
  { sku: "SCI-ICE", name: "Ice-core drill consumables", unit: "kit", category: "scientific", shelfLifeDays: 1825, critical: false },
  { sku: "WST-METAL", name: "Scrap metal (retrograde)", unit: "kg", category: "waste", shelfLifeDays: 99999, critical: false },
  { sku: "WST-HAZ", name: "Hazardous waste (retrograde)", unit: "kg", category: "waste", shelfLifeDays: 99999, critical: false },
];

const items: InventoryItem[] = itemDefs.map((d, i) => ({
  id: `it-${String(i + 1).padStart(2, "0")}`,
  ...d,
}));

const stockedStations = ["st-maitri", "st-bharati", "st-himadri"];

const consumptionPerDay: Record<string, number> = {
  "it-01": 420, "it-02": 12, "it-03": 9, "it-04": 46, "it-05": 24,
  "it-06": 30, "it-07": 11, "it-08": 18, "it-09": 4, "it-10": 1.4,
  "it-11": 2.2, "it-12": 0.8, "it-13": 3.1, "it-14": 0.6, "it-15": 0.9,
  "it-16": 0.15, "it-17": 0.2, "it-18": 0.1, "it-19": 0.08, "it-20": 0.3,
};

const batches: InventoryBatch[] = [];
stockedStations.forEach((sid, si) => {
  const crewFactor = si === 1 ? 1.7 : si === 2 ? 0.7 : 1;
  items.slice(0, 22).forEach((it, ii) => {
    if (it.category === "waste") return;
    const perDay = consumptionPerDay[it.id] ?? 1;
    const coverDays = [42, 210, 165, 96, 38, 300, 250, 120, 30][(si + ii) % 9];
    const qty = Math.round(perDay * coverDays * crewFactor * between(0.55, 1.15) * 10) / 10;
    batches.push({
      id: `bt-${sid}-${it.id}`,
      stationId: sid,
      itemId: it.id,
      batch: `B-${2600 + ii * 7 + si}`,
      qty: Math.max(qty, 0),
      minThreshold: Math.round(perDay * 30 * 10) / 10,
      expiryDate: daysFrom(TODAY, Math.max(it.shelfLifeDays - intBetween(30, 400), 20)),
    });
  });
});

const firstNames = ["Arjun", "Neha", "Ravi", "Priya", "Vikram", "Ananya", "Suresh", "Meera", "Karan", "Divya", "Rahul", "Ishita", "Sanjay", "Pooja", "Amit", "Sneha", "Deepak", "Kavya", "Manoj", "Ritu", "Nikhil", "Tanvi", "Ajay", "Lakshmi"];
const lastNames = ["Sharma", "Iyer", "Verma", "Nair", "Reddy", "Menon", "Patel", "Rao", "Singh", "Joshi", "Das", "Kulkarni"];
const roles = ["Glaciologist", "Doctor", "Engineer", "Cook", "Meteorologist", "Geophysicist", "Electrician", "Communications", "Logistics", "Biologist", "Mechanic", "Radio Operator"];
const blood = ["A+", "B+", "O+", "AB+", "A-", "O-", "B-"];

const personnel: Personnel[] = Array.from({ length: 28 }).map((_, i) => {
  const stationId = i < 10 ? "st-maitri" : i < 22 ? "st-bharati" : "st-himadri";
  const team: Personnel["team"] = i % 5 === 0 ? "winter" : "summer";
  const state: Personnel["state"] =
    i < 16 ? "AT_STATION" : i < 21 ? "IN_TRANSIT" : i < 25 ? "REPORTED_GOA" : "TRAINED";
  return {
    id: `pe-${String(i + 1).padStart(2, "0")}`,
    name: `${firstNames[i % firstNames.length]} ${pick(lastNames)}`,
    role: roles[i % roles.length],
    team,
    medicalClearance: i !== 7,
    training: i % 4 === 0 ? ["Firefighting", "Survival", "First aid"] : i % 3 === 0 ? ["Firefighting", "Survival"] : ["Survival"],
    bloodGroup: blood[i % blood.length],
    emergencyContact: `+91 98${intBetween(10, 99)}${intBetween(100000, 999999)}`,
    stationId: state === "AT_STATION" ? stationId : state === "IN_TRANSIT" ? "st-cpt" : undefined,
    state,
  };
});

const assetDefs = [
  { type: "Snowmobile", name: "Polaris 600" },
  { type: "Generator", name: "Cummins 250 kVA" },
  { type: "Generator", name: "Caterpillar 150 kVA" },
  { type: "Vehicle", name: "Arctic truck" },
  { type: "Instrument", name: "Automatic weather station" },
  { type: "Instrument", name: "Magnetometer" },
  { type: "Crane", name: "Ice-crane" },
  { type: "Incinerator", name: "Waste incinerator" },
  { type: "Water plant", name: "RO desalination unit" },
  { type: "Snowmobile", name: "Lynx 6900" },
  { type: "Instrument", name: "Ionospheric sounder" },
  { type: "Vehicle", name: "Pistenbully" },
];
const conditions: Asset["condition"][] = ["good", "good", "fair", "needs_attention", "good", "fair", "down"];

const groundAssets: Asset[] = assetDefs.map((a, i) => {
  const stationId = stockedStations[i % stockedStations.length];
  const maintenanceDue = [5, -3, 40, 12, -1, 60, 25, 3, 80, 18, -6, 45][i];
  return {
    id: `ga-${String(i + 1).padStart(2, "0")}`,
    tag: `NCP-${a.type.slice(0, 3).toUpperCase()}-${100 + i}`,
    name: a.name,
    type: a.type,
    stationId,
    condition: conditions[i % conditions.length],
    hoursRun: intBetween(400, 24000),
    nextMaintenance: daysFrom(TODAY, maintenanceDue),
    lastService: daysFrom(TODAY, -intBetween(30, 400)),
  };
});

const maintenance: MaintenanceLog[] = groundAssets.slice(0, 6).map((a, i) => ({
  id: `ml-${i + 1}`,
  assetId: a.id,
  action: ["Oil & filter change", "Belt replacement", "Calibration", "Bearing overhaul", "Software update", "Track alignment"][i],
  by: pick(personnel).name,
  ts: daysFrom(TODAY, -intBetween(3, 60)),
  notes: i % 2 === 0 ? "Completed without issue." : "Follow-up inspection scheduled.",
}));

const cargoDefs = [
  { d: "Food & provisions pallets", c: "food" as const, w: 8400, dest: "st-bharati", o: "st-hq" },
  { d: "Diesel transfer drums", c: "fuel" as const, w: 15000, dest: "st-maitri", o: "st-cpt" },
  { d: "Insulin cold-chain box", c: "medical" as const, w: 42, dest: "st-bharati", o: "st-hq" },
  { d: "Generator spare kits", c: "spares" as const, w: 610, dest: "st-maitri", o: "st-hq" },
  { d: "Seismic sensor array", c: "scientific" as const, w: 980, dest: "st-bharati", o: "st-mum" },
  { d: "Emergency vaccine fridge", c: "medical" as const, w: 120, dest: "st-maitri", o: "st-hq" },
  { d: "Composite ration packs", c: "food" as const, w: 5200, dest: "st-maitri", o: "st-hq" },
  { d: "Ice-core drill consumables", c: "scientific" as const, w: 340, dest: "st-bharati", o: "st-cpt" },
  { d: "Medical oxygen cylinders", c: "medical" as const, w: 720, dest: "st-bharati", o: "st-hq" },
  { d: "Snowmobile track sets", c: "spares" as const, w: 460, dest: "st-maitri", o: "st-mum" },
  { d: "Frozen vegetables (reefer)", c: "food" as const, w: 3100, dest: "st-bharati", o: "st-cpt" },
  { d: "Lab reagent kits", c: "scientific" as const, w: 95, dest: "st-himadri", o: "st-hq" },
  { d: "Jet A1 barrels", c: "fuel" as const, w: 18000, dest: "st-maitri", o: "st-cpt" },
  { d: "Retrograde scrap metal", c: "waste" as const, w: 7400, dest: "st-cpt", o: "st-bharati" },
  { d: "Hazardous waste (batteries)", c: "waste" as const, w: 380, dest: "st-cpt", o: "st-maitri" },
  { d: "Communications spares", c: "spares" as const, w: 210, dest: "st-bharati", o: "st-hq" },
];

const statusByIndex: Consignment["status"][] = [
  "IN_TRANSIT_TO_PORT", "AT_HUB", "IN_TRANSIT_TO_PORT", "PACKED_GOA",
  "AT_PORT", "PLANNED", "PACKED_GOA", "AT_HUB", "LOADED", "AT_PORT",
  "AT_HUB", "PLANNED", "AT_HUB", "OFFLOADED", "LOADED", "IN_TRANSIT_TO_PORT",
];

const consignments: Consignment[] = cargoDefs.map((c, i) => ({
  id: `cs-${String(i + 1).padStart(3, "0")}`,
  qrCode: `POLAR-46ISEA-${String(1000 + i)}`,
  expeditionId: c.dest === "st-himadri" ? "ex-arctic" : "ex-46",
  description: c.d,
  originStationId: c.o,
  destinationStationId: c.dest,
  category: c.c,
  weightKg: c.w,
  volumeM3: Math.round((c.w / 250) * 10) / 10,
  priority: c.c === "medical" ? "P0" : c.c === "waste" ? "P2" : "P1",
  hazmatClass: c.c === "fuel" ? "Class 3 (flammable liquid)" : c.d.includes("batteries") ? "Class 8 (corrosive)" : undefined,
  tempReq: c.d.includes("Insulin") ? "2-8 C" : c.d.includes("vaccine") || c.d.includes("Frozen") || c.d.includes("reefer") ? "-20 C" : undefined,
  status: statusByIndex[i],
  legId: legs[i % legs.length].id,
}));

const stateToStation: Record<string, string> = {
  PLANNED: "st-hq",
  PACKED_GOA: "st-hq",
  IN_TRANSIT_TO_PORT: "st-hq",
  AT_PORT: "st-mum",
  AT_HUB: "st-cpt",
  LOADED: "st-ship",
  OFFLOADED: "st-cpt",
  RECEIVED_STATION: "st-bharati",
  CONSUMED: "st-bharati",
  RETROGRADE: "st-cpt",
  WASTE_RETURNED: "st-cpt",
};

const pathFor = (status: Consignment["status"]): Consignment["status"][] => {
  const full: Consignment["status"][] = ["PLANNED", "PACKED_GOA", "IN_TRANSIT_TO_PORT", "AT_PORT", "AT_HUB", "LOADED"];
  const idx = full.indexOf(status);
  return idx >= 0 ? full.slice(0, idx + 1) : full;
};

const custody: CustodyEvent[] = [];
const scanActors = ["R. Nair (HQ)", "S. Menon (Store)", "A. Rao (Ship Ops)", "M. Iyer (Store)", "K. Das (HQ)"];

consignments.forEach((cs) => {
  const path = pathFor(cs.status);
  let prevHash = GENESIS_HASH;
  path.forEach((state, i) => {
    const stationId = stateToStation[state] ?? "st-hq";
    const station = stations.find((s) => s.id === stationId)!;
    const ts = iso(new Date(Date.parse(cs.legId ? legs.find((l) => l.id === cs.legId)!.plannedDepart : iso(TODAY)) - (path.length - 1 - i) * 3600000 * 14));
    const actor = scanActors[(path.length + i) % scanActors.length];
    const jitter = () => (rand() - 0.5) * 0.02;
    const hash = digest(prevHash, cs.id, state, ts, stationId, actor);
    custody.push({
      id: `ce-${cs.id}-${i}`,
      consignmentId: cs.id,
      legId: cs.legId,
      stationId,
      eventType: `scan:${state.toLowerCase()}`,
      fromState: i === 0 ? "NEW" : path[i - 1],
      toState: state,
      scannedBy: actor,
      ts,
      lat: station.lat + jitter(),
      lon: station.lon + jitter(),
      prevHash,
      hash,
    });
    prevHash = hash;
  });
});

const incidentDefs = [
  { t: "medical" as const, sev: "critical" as const, st: "st-bharati", p: "pe-11", s: "Crew member with abdominal pain, suspected appendicitis.", by: "Dr. Menon" },
  { t: "weather" as const, sev: "high" as const, st: "st-maitri", s: "Katabatic winds above 40 kts, movement restricted.", by: "Station Leader" },
  { t: "equipment" as const, sev: "medium" as const, st: "st-maitri", s: "Primary generator 2 running hot, load shifted to backup.", by: "Engineer" },
  { t: "missing_person" as const, sev: "high" as const, st: "st-himadri", s: "Researcher overdue from field route by 90 minutes.", by: "Logistics" },
  { t: "fire" as const, sev: "low" as const, st: "st-bharati", s: "Smoke in incinerator flue, extinguished, monitoring.", by: "Store Keeper" },
];

const incidents: Incident[] = incidentDefs.map((x, i) => ({
  id: `in-${i + 1}`,
  type: x.t,
  severity: x.sev,
  stationId: x.st,
  personId: x.p,
  summary: x.s,
  reportedBy: x.by,
  status: (["RESPONSE_ACTIVE", "ACKNOWLEDGED", "ACKNOWLEDGED", "MUSTER_COMPLETE", "RESOLVED"] as Incident["status"][])[i],
  createdAt: hoursFrom(TODAY, -(i * 6 + 3)),
}));

const incidentActions: IncidentAction[] = incidents.flatMap((inc, i) => [
  { id: `ia-${i}-1`, incidentId: inc.id, action: "Incident raised and acknowledged.", by: inc.reportedBy, ts: hoursFrom(TODAY, -(i * 6 + 3)) },
  { id: `ia-${i}-2`, incidentId: inc.id, action: i === 0 ? "Medical officer contacted; evacuation options generated." : "Muster roll-call completed for affected area.", by: "HQ Duty Officer", ts: hoursFrom(TODAY, -(i * 6 + 1)) },
]);

const wasteDefs: { c: WasteEntry["category"]; st: string; q: number; s: WasteEntry["stage"] }[] = [
  { c: "metal", st: "st-bharati", q: 7400, s: "loaded" },
  { c: "hazardous", st: "st-maitri", q: 380, s: "packed" },
  { c: "plastic", st: "st-bharati", q: 620, s: "segregated" },
  { c: "biological", st: "st-maitri", q: 140, s: "packed" },
  { c: "paper", st: "st-himadri", q: 90, s: "generated" },
  { c: "glass", st: "st-bharati", q: 210, s: "segregated" },
  { c: "hazardous", st: "st-bharati", q: 260, s: "loaded" },
  { c: "metal", st: "st-maitri", q: 3200, s: "generated" },
];

const waste: WasteEntry[] = wasteDefs.map((w, i) => ({
  id: `wst-${i + 1}`,
  category: w.c,
  stationId: w.st,
  qtyKg: w.q,
  stage: w.s,
  updatedAt: hoursFrom(TODAY, -intBetween(1, 40)),
}));

const syncLog: SyncEvent[] = Array.from({ length: 18 }).map((_, i) => {
  const priority: SyncEvent["priority"] = i < 4 ? "P0" : i < 12 ? "P1" : "P2";
  const entity = ["incident", "inventory_txn", "custody_event", "personnel_move", "photo", "bulk_log"][i % 6];
  const bytes = priority === "P0" ? 74 : priority === "P1" ? intBetween(120, 900) : intBetween(2000, 48000);
  return {
    id: `sy-${i + 1}`,
    eventUuid: digest(`event-${i}`).slice(0, 12),
    originNode: pick(["maitri-edge", "bharati-edge", "ship-edge", "himadri-edge"]),
    entity,
    op: (["create", "update", "delta", "append"] as SyncEvent["op"][])[i % 4],
    payload: `{${entity}:${i}}`,
    lamportTs: 1200 + i * 3,
    priority,
    bytes,
    appliedAt: i < 15 ? hoursFrom(TODAY, -(18 - i)) : undefined,
  };
});

const alerts: Alert[] = [
  { id: "al-1", kind: "stock", severity: "critical", title: "Insulin below 45-day cover at Bharati", detail: "Cold-chain stock covers 38 days against a resupply gap of 61 days.", stationId: "st-bharati", ts: hoursFrom(TODAY, -2) },
  { id: "al-2", kind: "stock", severity: "critical", title: "Diesel low at Maitri", detail: "Autonomy 42 days; next feasible leg is 58 days out.", stationId: "st-maitri", ts: hoursFrom(TODAY, -3) },
  { id: "al-3", kind: "expiry", severity: "warning", title: "6 batches expiring within 30 days", detail: "Frozen vegetables and eggs across Bharati cold store.", stationId: "st-bharati", ts: hoursFrom(TODAY, -5) },
  { id: "al-4", kind: "weather", severity: "warning", title: "Katabatic wind gate active at Maitri", detail: "Basler leg may slip; weather gate blocks flight ops.", stationId: "st-maitri", ts: hoursFrom(TODAY, -1) },
  { id: "al-5", kind: "maintenance", severity: "warning", title: "Generator 2 maintenance overdue", detail: "Cummins 250 kVA past scheduled service by 3 days.", stationId: "st-maitri", ts: hoursFrom(TODAY, -8) },
  { id: "al-6", kind: "scan", severity: "info", title: "Consignment dwell anomaly", detail: "2 consignments exceeded expected dwell at Cape Town hub.", stationId: "st-cpt", ts: hoursFrom(TODAY, -10) },
];

export function buildSeed(): Dataset {
  return {
    stations,
    assets,
    expeditions,
    legs,
    items,
    batches,
    personnel,
    groundAssets,
    consignments,
    custody,
    txns: [],
    incidents,
    incidentActions,
    maintenance,
    waste,
    syncLog,
    alerts,
  };
}

/** Synthetic daily consumption series (last `n` days) per station/item. */
export function consumptionSeries(stationId: ID, itemId: ID, n = 120): number[] {
  const seed = [...`${stationId}${itemId}`].reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = mulberry32(seed);
  const base = consumptionPerDay[itemId] ?? 1;
  const stationFactor = stationId === "st-bharati" ? 1.7 : stationId === "st-himadri" ? 0.7 : 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const seasonal = 1 + 0.28 * Math.sin((i / 365) * Math.PI * 2 + 1.2);
    const crew = 1 + 0.18 * Math.sin((i / 180) * Math.PI * 2);
    const noise = 1 + (r() - 0.5) * 0.24;
    out.push(Math.max(0, base * stationFactor * seasonal * crew * noise));
  }
  return out;
}

export const CONSUMPTION_BASE = consumptionPerDay;
