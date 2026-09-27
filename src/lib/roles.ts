import type { ID, Role } from "@/lib/types";

export const ROLES: Record<Role, { label: string; scope: ID | "all" }> = {
  hq_logistics: { label: "HQ Logistics Officer", scope: "all" },
  expedition_leader: { label: "Expedition Leader", scope: "all" },
  station_leader: { label: "Station Leader", scope: "st-maitri" },
  inventory_keeper: { label: "Store / Inventory Keeper", scope: "st-bharati" },
  medical_officer: { label: "Medical Officer", scope: "st-bharati" },
  ship_air_ops: { label: "Ship / Air Ops Coordinator", scope: "st-ship" },
  member: { label: "Expedition Member", scope: "st-maitri" },
};

export const ROLE_ORDER = Object.keys(ROLES) as Role[];
