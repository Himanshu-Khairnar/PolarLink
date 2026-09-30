import type { ID, Role } from "@/lib/types";

export type ActionKey =
  | "cargo.create"
  | "cargo.scan"
  | "cargo.verify"
  | "cargo.tamper"
  | "inventory.txn"
  | "inventory.add"
  | "personnel.add"
  | "personnel.muster"
  | "assets.service"
  | "assets.create"
  | "emergency.raise"
  | "emergency.advance"
  | "expeditions.create"
  | "expeditions.addLeg"
  | "waste.advance"
  | "sync.flush"
  | "simulator.run";

export interface RoleDef {
  label: string;
  /** One-line description shown on the role picker. */
  blurb: string;
  /** Default station scope this role opens on. */
  scope: ID | "all";
  /** Allowed route hrefs, or "all". */
  pages: string[] | "all";
  /** Allowed action keys, or "all". */
  actions: ActionKey[] | "all";
}

const OPERATIONS_LEAD = [
  "/",
  "/expeditions",
  "/cargo",
  "/inventory",
  "/personnel",
  "/assets",
  "/emergency",
];

const STATION_LEAD = [
  "/",
  "/expeditions",
  "/cargo",
  "/inventory",
  "/personnel",
  "/assets",
  "/emergency",
  "/waste",
];

const STORE_KEEPER = ["/", "/cargo", "/inventory", "/assets", "/waste", "/sync"];

const MEDICAL = ["/", "/cargo", "/inventory", "/personnel", "/emergency"];

const SHIP_AIR = ["/", "/expeditions", "/cargo", "/emergency", "/sync"];

const MEMBER = ["/", "/personnel", "/cargo", "/inventory"];

export const ROLES: Record<Role, RoleDef> = {
  hq_logistics: {
    label: "HQ Logistics Officer",
    blurb: "Full command centre across every station and the whole season.",
    scope: "all",
    pages: "all",
    actions: "all",
  },
  expedition_leader: {
    label: "Expedition Leader",
    blurb: "Owns the season plan and every operational decision network-wide.",
    scope: "all",
    pages: OPERATIONS_LEAD,
    actions: [
      "cargo.create",
      "cargo.scan",
      "cargo.verify",
      "cargo.tamper",
      "inventory.txn",
      "personnel.muster",
      "assets.service",
      "assets.create",
      "emergency.raise",
      "emergency.advance",
      "expeditions.create",
      "expeditions.addLeg",
      "waste.advance",
      "sync.flush",
      "simulator.run",
    ],
  },
  station_leader: {
    label: "Station Leader",
    blurb: "Runs Maitri: stock, people, assets and incident response on station.",
    scope: "st-maitri",
    pages: STATION_LEAD,
    actions: [
      "cargo.scan",
      "cargo.verify",
      "inventory.txn",
      "personnel.muster",
      "assets.service",
      "assets.create",
      "emergency.raise",
      "emergency.advance",
      "waste.advance",
    ],
  },
  inventory_keeper: {
    label: "Store / Inventory Keeper",
    blurb: "Bharati store: stock, scans, service logs and the sync queue.",
    scope: "st-bharati",
    pages: STORE_KEEPER,
    actions: [
      "cargo.create",
      "cargo.scan",
      "inventory.txn",
      "inventory.add",
      "assets.service",
      "assets.create",
      "waste.advance",
      "sync.flush",
    ],
  },
  medical_officer: {
    label: "Medical Officer",
    blurb: "Bharati medical bay: stock cover, muster and emergency response.",
    scope: "st-bharati",
    pages: MEDICAL,
    actions: [
      "cargo.scan",
      "inventory.txn",
      "personnel.muster",
      "emergency.raise",
      "emergency.advance",
    ],
  },
  ship_air_ops: {
    label: "Ship / Air Ops Coordinator",
    blurb: "Moves cargo and people: legs, manifests, custody and the P0 lane.",
    scope: "st-ship",
    pages: SHIP_AIR,
    actions: [
      "cargo.scan",
      "cargo.verify",
      "emergency.raise",
      "emergency.advance",
      "expeditions.addLeg",
      "sync.flush",
      "simulator.run",
    ],
  },
  member: {
    label: "Expedition Member",
    blurb: "Read-only: your station's roster, cargo and stock cover.",
    scope: "st-maitri",
    pages: MEMBER,
    actions: [],
  },
};

export const ROLE_ORDER = Object.keys(ROLES) as Role[];
