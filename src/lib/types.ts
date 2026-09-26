export type ID = string;
export type ISODate = string;

export type Role =
  | "hq_logistics"
  | "expedition_leader"
  | "station_leader"
  | "inventory_keeper"
  | "medical_officer"
  | "ship_air_ops"
  | "member";

export type StationType =
  | "station"
  | "ship"
  | "hub"
  | "port"
  | "foreign_station"
  | "airport"
  | "hq";

export type Risk = "CRITICAL" | "WATCH" | "OK";

export type ConsignmentStatus =
  | "PLANNED"
  | "PACKED_GOA"
  | "IN_TRANSIT_TO_PORT"
  | "AT_PORT"
  | "AT_HUB"
  | "LOADED"
  | "OFFLOADED"
  | "RECEIVED_STATION"
  | "CONSUMED"
  | "RETROGRADE"
  | "WASTE_RETURNED";

export type CargoCategory =
  | "food"
  | "fuel"
  | "scientific"
  | "medical"
  | "spares"
  | "waste";

export type SyncPriority = "P0" | "P1" | "P2";

export interface Station {
  id: ID;
  name: string;
  shortName: string;
  type: StationType;
  lat: number;
  lon: number;
  capacity: number;
  /** UTC offset used in the local clock */
  tz: string;
  facilities: string[];
}

export interface TransportAsset {
  id: ID;
  name: string;
  type: "ship" | "il76" | "basler" | "twin_otter" | "helicopter" | "truck";
  capacityKg: number;
  seats: number;
  speedKts?: number;
  status: "available" | "in_transit" | "maintenance" | "standby";
}

export interface Expedition {
  id: ID;
  code: string;
  name: string;
  type: "antarctic" | "arctic" | "southern_ocean";
  seasonStart: ISODate;
  seasonEnd: ISODate;
  status: "planning" | "active" | "completed";
}

export interface Leg {
  id: ID;
  expeditionId: ID;
  fromStationId: ID;
  toStationId: ID;
  assetId: ID;
  mode: string;
  plannedDepart: ISODate;
  plannedArrive: ISODate;
  actualDepart?: ISODate;
  actualArrive?: ISODate;
  seasonOnly: boolean;
  status: "planned" | "loading" | "in_transit" | "arrived" | "delayed";
}

export interface Consignment {
  id: ID;
  qrCode: string;
  expeditionId: ID;
  description: string;
  originStationId: ID;
  destinationStationId: ID;
  category: CargoCategory;
  weightKg: number;
  volumeM3: number;
  priority: SyncPriority;
  hazmatClass?: string;
  tempReq?: string;
  status: ConsignmentStatus;
  legId?: ID;
}

export interface CustodyEvent {
  id: ID;
  consignmentId: ID;
  legId?: ID;
  stationId: ID;
  eventType: string;
  fromState: string;
  toState: ConsignmentStatus;
  scannedBy: string;
  ts: ISODate;
  lat: number;
  lon: number;
  prevHash: string;
  hash: string;
  note?: string;
}

export interface InventoryItem {
  id: ID;
  sku: string;
  name: string;
  unit: string;
  category: CargoCategory;
  shelfLifeDays: number;
  critical: boolean;
}

export interface InventoryBatch {
  id: ID;
  stationId: ID;
  itemId: ID;
  batch: string;
  qty: number;
  minThreshold: number;
  expiryDate: ISODate;
}

export interface InventoryTxn {
  id: ID;
  stationId: ID;
  itemId: ID;
  delta: number;
  reason: "received" | "consumed" | "transfer" | "wastage" | "count_adj";
  actor: string;
  ts: ISODate;
  originNode: string;
}

export interface AutonomyRow {
  itemId: ID;
  name: string;
  unit: string;
  category: CargoCategory;
  critical: boolean;
  stock: number;
  dailyUse: number;
  daysLeft: number;
  nextResupplyDays: number;
  risk: Risk;
}

export interface Personnel {
  id: ID;
  name: string;
  role: string;
  team: "summer" | "winter";
  medicalClearance: boolean;
  training: string[];
  bloodGroup: string;
  emergencyContact: string;
  stationId?: ID;
  state:
    | "NOMINATED"
    | "MEDICALLY_CLEARED"
    | "TRAINED"
    | "REPORTED_GOA"
    | "IN_TRANSIT"
    | "AT_STATION"
    | "DE_INDUCTED"
    | "EVACUATED";
}

export interface Asset {
  id: ID;
  tag: string;
  name: string;
  type: string;
  stationId: ID;
  condition: "good" | "fair" | "needs_attention" | "down";
  hoursRun: number;
  nextMaintenance: ISODate;
  lastService?: ISODate;
}

export interface MaintenanceLog {
  id: ID;
  assetId: ID;
  action: string;
  by: string;
  ts: ISODate;
  notes?: string;
}

export interface Incident {
  id: ID;
  type: "medical" | "fire" | "missing_person" | "equipment" | "weather";
  severity: "low" | "medium" | "high" | "critical";
  stationId: ID;
  personId?: ID;
  summary: string;
  reportedBy: string;
  status:
    | "RAISED"
    | "ACKNOWLEDGED"
    | "MUSTER_COMPLETE"
    | "RESPONSE_ACTIVE"
    | "EVACUATING"
    | "RESOLVED"
    | "REVIEWED";
  createdAt: ISODate;
}

export interface IncidentAction {
  id: ID;
  incidentId: ID;
  action: string;
  by: string;
  ts: ISODate;
}

export interface SyncEvent {
  id: ID;
  eventUuid: string;
  originNode: string;
  entity: string;
  op: "create" | "update" | "delta" | "append";
  payload: string;
  lamportTs: number;
  priority: SyncPriority;
  bytes: number;
  appliedAt?: ISODate;
}

export interface WasteEntry {
  id: ID;
  category: "metal" | "plastic" | "hazardous" | "biological" | "paper" | "glass";
  stationId: ID;
  qtyKg: number;
  stage: "generated" | "segregated" | "packed" | "loaded" | "returned";
  updatedAt: ISODate;
}

export interface Alert {
  id: ID;
  kind: "stock" | "expiry" | "scan" | "maintenance" | "weather" | "sync";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  stationId?: ID;
  ts: ISODate;
}

export interface EvacRoute {
  id: string;
  label: string;
  hops: string[];
  totalHours: number;
  weatherOkProb: number;
  transfers: number;
  medicalGap: number;
  feasible: boolean;
  score: number;
}

export interface SimulationResult {
  delayDays: number;
  targetLegId: ID;
  confidence: number;
  failedDeliveries: { consignmentId: ID; description: string; reason: string }[];
  stationImpact: { stationId: ID; item: string; risk: Risk; shortfallDays: number }[];
  legs: { legId: ID; slippedDays: number; missed: boolean }[];
}

export interface ChatMessage {
  id: ID;
  role: "user" | "assistant";
  content: string;
  ts: ISODate;
}
