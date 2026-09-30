"use client";

import * as React from "react";
import { toast } from "sonner";
import { buildSeed, consumptionSeries, type Dataset, TODAY } from "@/lib/data/seed";
import { digest, GENESIS_HASH } from "@/lib/hash";
import { ROLES, type ActionKey } from "@/lib/roles";
import {
  computeAutonomy,
  detectAnomalies,
  type ForecastPoint,
  forecastSeries,
} from "@/lib/engine";
import type {
  Alert,
  Asset,
  AutonomyRow,
  CargoCategory,
  Consignment,
  ConsignmentStatus,
  CustodyEvent,
  Expedition,
  ID,
  Incident,
  InventoryItem,
  InventoryTxn,
  Leg,
  Personnel,
  Role,
  SimulationResult,
  Station,
  SyncEvent,
  SyncPriority,
  WasteEntry,
} from "@/lib/types";

export interface CreateExpeditionInput {
  code: string;
  name: string;
  type: Expedition["type"];
  seasonStart: string;
  seasonEnd: string;
  status?: Expedition["status"];
}

export type LinkMode = "online" | "throttled" | "offline";

const ROLE_STORAGE_KEY = "polarlink:role";

function readStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(ROLE_STORAGE_KEY);
  return stored && stored in ROLES ? (stored as Role) : null;
}

interface Session {
  role: Role;
}

let sessionStore: Session | null = (() => {
  const r = readStoredRole();
  return r ? { role: r } : null;
})();
const sessionListeners = new Set<() => void>();

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function setStoredSession(role: Role | null) {
  sessionStore = role ? { role } : null;
  if (typeof window !== "undefined") {
    if (role) window.sessionStorage.setItem(ROLE_STORAGE_KEY, role);
    else window.sessionStorage.removeItem(ROLE_STORAGE_KEY);
  }
  sessionListeners.forEach((listener) => listener());
}

export interface StoreValue {
  data: Dataset;
  stationById: Map<ID, Station>;
  today: Date;
  role: Role;
  setRole: (r: Role) => void;
  /** True once a role has been picked on the sign-in screen. */
  authed: boolean;
  login: (r: Role) => void;
  logout: () => void;
  /** Whether the current role may perform an action. */
  can: (action: ActionKey) => boolean;
  /** Whether the current role may open a route. */
  canPage: (href: string) => boolean;
  /** Whether a station falls inside the current role scope. */
  inScope: (stationId?: ID) => boolean;
  scope: ID | "all";
  setScope: (s: ID | "all") => void;
  link: LinkMode;
  setLink: (m: LinkMode) => void;
  glare: boolean;
  setGlare: (v: boolean) => void;
  /** Per-station Days of Autonomy rows. */
  autonomy: Record<ID, AutonomyRow[]>;
  nextResupplyDays: (stationId: ID) => number;
  forecast: (stationId: ID, itemId: ID, horizon?: number) => ForecastPoint[];
  anomalies: ReturnType<typeof detectAnomalies>;
  scanConsignment: (
    consignmentId: ID,
    toState: ConsignmentStatus,
    stationId: ID,
    actor?: string
  ) => void;
  addInventoryTxn: (txn: Omit<InventoryTxn, "id" | "ts" | "originNode">) => void;
  addInventoryItem: (input: {
    sku: string;
    name: string;
    unit: string;
    category: InventoryItem["category"];
    shelfLifeDays: number;
    critical: boolean;
    stationId: ID;
    openingQty: number;
  }) => InventoryItem;
  addPersonnel: (input: {
    name: string;
    role: string;
    team: Personnel["team"];
    medicalClearance: boolean;
    training: string[];
    bloodGroup: string;
    emergencyContact: string;
    stationId?: ID;
    state?: Personnel["state"];
  }) => Personnel;
  updatePersonnel: (
    id: ID,
    patch: { stationId?: ID; state?: Personnel["state"] }
  ) => void;
  createConsignment: (input: {
    description: string;
    category: CargoCategory;
    originStationId: ID;
    destinationStationId: ID;
    expeditionId: ID;
    weightKg: number;
    volumeM3?: number;
    priority?: SyncPriority;
    hazmatClass?: string;
    tempReq?: string;
  }) => Consignment;
  raiseIncident: (input: {
    type: Incident["type"];
    severity: Incident["severity"];
    stationId: ID;
    personId?: ID;
    summary: string;
  }) => Incident;
  advanceIncident: (incidentId: ID, status: Incident["status"], action: string) => void;
  logMaintenance: (assetId: ID, action: string, notes?: string) => void;
  addAsset: (input: {
    name: string;
    type: string;
    stationId: ID;
    condition?: Asset["condition"];
    hoursRun?: number;
    nextMaintenanceDays?: number;
  }) => Asset;
  setWasteStage: (id: ID, stage: WasteEntry["stage"]) => void;
  simulate: (result: SimulationResult | null) => void;
  simulation: SimulationResult | null;
  verifyChain: (consignmentId: ID) => { ok: boolean; brokenAt?: string };
  tamperCustody: (consignmentId: ID) => void;
  scanTicker: number;
  pushSync: (priority: SyncPriority, entity: string, op: SyncEvent["op"], payload: string) => void;
  drainSync: (budgetBytes: number) => void;
  resetDemo: () => void;
  createExpedition: (input: CreateExpeditionInput) => Expedition;
  addLeg: (input: { expeditionId: ID; fromStationId: ID; toStationId: ID; assetId: ID; mode: string; plannedDepart: string; plannedArrive: string }) => Leg;
}

const StoreContext = React.createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<Dataset>(() => buildSeed());
  const session = React.useSyncExternalStore(
    subscribeSession,
    () => sessionStore,
    () => null
  );
  const authed = session !== null;
  const role = session?.role ?? "hq_logistics";
  const [scopeOverride, setScopeOverride] = React.useState<ID | "all" | null>(
    null
  );
  const scope = scopeOverride ?? ROLES[role].scope;
  const [link, setLinkState] = React.useState<LinkMode>("online");
  const [glare, setGlare] = React.useState(false);
  const [simulation, setSimulation] = React.useState<SimulationResult | null>(null);
  const [scanTicker, setScanTicker] = React.useState(0);
  const today = React.useMemo(() => TODAY, []);

  const stationById = React.useMemo(
    () => new Map<ID, Station>(data.stations.map((s) => [s.id, s])),
    [data.stations]
  );

  const setRole = React.useCallback((r: Role) => {
    setStoredSession(r);
    setScopeOverride(null);
  }, []);

  const setScope = React.useCallback((s: ID | "all") => {
    setScopeOverride(s);
  }, []);

  const login = React.useCallback(
    (r: Role) => {
      setRole(r);
    },
    [setRole]
  );

  const logout = React.useCallback(() => {
    setStoredSession(null);
    setScopeOverride(null);
  }, []);

  const can = React.useCallback(
    (action: ActionKey) => {
      const def = ROLES[role];
      return def.actions === "all" || def.actions.includes(action);
    },
    [role]
  );

  const canPage = React.useCallback(
    (href: string) => {
      const def = ROLES[role];
      return def.pages === "all" || def.pages.includes(href);
    },
    [role]
  );

  const inScope = React.useCallback(
    (stationId?: ID) => {
      if (scope === "all") return true;
      return stationId === scope;
    },
    [scope]
  );

  const nextResupplyDays = React.useCallback(
    (stationId: ID) => {
      const upcoming = data.legs
        .filter((l) => l.toStationId === stationId)
        .map((l) => Date.parse(l.plannedArrive))
        .filter((t) => t >= today.getTime())
        .sort((a, b) => a - b);
      if (!upcoming.length) return 120;
      return Math.max(1, Math.round((upcoming[0] - today.getTime()) / 86400000));
    },
    [data.legs, today]
  );

  const autonomy = React.useMemo(() => {
    const out: Record<ID, AutonomyRow[]> = {};
    data.stations
      .filter((s) => s.type === "station")
      .forEach((s) => {
        out[s.id] = computeAutonomy(s, data.items, data.batches, nextResupplyDays(s.id));
      });
    return out;
  }, [data.stations, data.items, data.batches, nextResupplyDays]);

  const forecast = React.useCallback(
    (stationId: ID, itemId: ID, horizon = 90) => {
      const series = consumptionSeries(stationId, itemId, 120);
      return forecastSeries(series, horizon);
    },
    []
  );

  const anomalies = React.useMemo(
    () => detectAnomalies(data.consignments, data.custody),
    [data.consignments, data.custody]
  );

  const scanConsignment = React.useCallback(
    (consignmentId: ID, toState: ConsignmentStatus, stationId: ID, actor = "Field scan") => {
      setData((prev) => {
        const cs = prev.consignments.find((c) => c.id === consignmentId);
        if (!cs) return prev;
        const station = prev.stations.find((s) => s.id === stationId);
        const chain = prev.custody
          .filter((c) => c.consignmentId === consignmentId)
          .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
        const prevHash = chain.length ? chain[chain.length - 1].hash : GENESIS_HASH;
        const ts = new Date().toISOString();
        const hash = digest(prevHash, cs.id, toState, ts, stationId, actor);
        const event: CustodyEvent = {
          id: `ce-${consignmentId}-${chain.length}-${Date.now()}`,
          consignmentId,
          legId: cs.legId,
          stationId,
          eventType: `scan:${toState.toLowerCase()}`,
          fromState: cs.status,
          toState,
          scannedBy: actor,
          ts,
          lat: (station?.lat ?? 0) + (Math.random() - 0.5) * 0.01,
          lon: (station?.lon ?? 0) + (Math.random() - 0.5) * 0.01,
          prevHash,
          hash,
        };
        const priority: SyncPriority = cs.priority;
        const syncEvent: SyncEvent = {
          id: `sy-live-${Date.now()}`,
          eventUuid: digest(event.id).slice(0, 12),
          originNode: `${station?.shortName ?? "edge"}-edge`,
          entity: "custody_event",
          op: "append",
          payload: `${cs.qrCode} -> ${toState}`,
          lamportTs: prev.syncLog.length + 5000,
          priority,
          bytes: 168,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          consignments: prev.consignments.map((c) =>
            c.id === consignmentId ? { ...c, status: toState } : c
          ),
          custody: [...prev.custody, event],
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      setScanTicker((t) => t + 1);
      const cs = data.consignments.find((c) => c.id === consignmentId);
      toast.success(`Scanned ${cs?.qrCode ?? consignmentId}`, {
        description:
          link === "offline"
            ? `Queued locally on ${link} link \u2014 will sync by priority lane.`
            : `Custody event written \u2192 ${toState.replaceAll("_", " ")}`,
      });
    },
    [data.consignments, link]
  );

  const addInventoryTxn = React.useCallback(
    (txn: Omit<InventoryTxn, "id" | "ts" | "originNode">) => {
      setData((prev) => {
        const newTxn: InventoryTxn = {
          ...txn,
          id: `txn-${Date.now()}`,
          ts: new Date().toISOString(),
          originNode: `${prev.stations.find((s) => s.id === txn.stationId)?.shortName ?? "edge"}-edge`,
        };
        let batches = prev.batches;
        if (txn.reason === "received") {
          batches = batches.map((b) =>
            b.stationId === txn.stationId && b.itemId === txn.itemId
              ? { ...b, qty: Math.max(0, b.qty + txn.delta) }
              : b
          );
          if (!batches.some((b) => b.stationId === txn.stationId && b.itemId === txn.itemId)) {
            batches = [
              ...batches,
              {
                id: `bt-${Date.now()}`,
                stationId: txn.stationId,
                itemId: txn.itemId,
                batch: `B-${Date.now() % 10000}`,
                qty: Math.max(0, txn.delta),
                minThreshold: 0,
                expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
              },
            ];
          }
        } else {
          const target = batches.find(
            (b) => b.stationId === txn.stationId && b.itemId === txn.itemId
          );
          if (target) {
            batches = batches.map((b) =>
              b.id === target.id
                ? { ...b, qty: Math.max(0, b.qty + txn.delta) }
                : b
            );
          }
        }
        const syncEvent: SyncEvent = {
          id: `sy-txn-${Date.now()}`,
          eventUuid: digest(newTxn.id).slice(0, 12),
          originNode: newTxn.originNode,
          entity: "inventory_txn",
          op: "delta",
          payload: `${txn.reason} ${txn.delta > 0 ? "+" : ""}${txn.delta}`,
          lamportTs: prev.syncLog.length + 6000,
          priority: "P1",
          bytes: 96,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          batches,
          txns: [newTxn, ...prev.txns],
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      toast.success("Inventory transaction recorded", {
        description: `${txn.reason.replaceAll("_", " ")} ${txn.delta > 0 ? "+" : ""}${txn.delta}`,
      });
    },
    [link]
  );

  const addInventoryItem = React.useCallback<StoreValue["addInventoryItem"]>(
    (input) => {
      const id = `it-${Date.now()}`;
      const item: InventoryItem = {
        id,
        sku: input.sku,
        name: input.name,
        unit: input.unit,
        category: input.category,
        shelfLifeDays: input.shelfLifeDays,
        critical: input.critical,
      };
      setData((prev) => {
        const batches =
          input.openingQty > 0
            ? [
                ...prev.batches,
                {
                  id: `bt-${id}`,
                  stationId: input.stationId,
                  itemId: id,
                  batch: `B-${Date.now() % 10000}`,
                  qty: Math.max(0, input.openingQty),
                  minThreshold: 0,
                  expiryDate: new Date(
                    Date.now() + Math.max(input.shelfLifeDays, 1) * 86400000
                  ).toISOString(),
                },
              ]
            : prev.batches;
        const syncEvent: SyncEvent = {
          id: `sy-item-${Date.now()}`,
          eventUuid: digest(`${id}-${input.sku}`).slice(0, 12),
          originNode: `${prev.stations.find((s) => s.id === input.stationId)?.shortName ?? "edge"}-edge`,
          entity: "inventory_item",
          op: "create",
          payload: `${input.sku}:${input.category}`,
          lamportTs: prev.syncLog.length + 7000,
          priority: "P1",
          bytes: 140,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          items: [...prev.items, item],
          batches,
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      toast.success("Inventory item added", {
        description: `${input.sku} \u00b7 ${input.name}`,
      });
      return item;
    },
    [link]
  );

  const addPersonnel = React.useCallback<StoreValue["addPersonnel"]>(
    (input) => {
      const id = `pe-${Date.now()}`;
      const person: Personnel = {
        id,
        name: input.name,
        role: input.role,
        team: input.team,
        medicalClearance: input.medicalClearance,
        training: input.training,
        bloodGroup: input.bloodGroup,
        emergencyContact: input.emergencyContact,
        stationId: input.stationId,
        state: input.state ?? "NOMINATED",
      };
      setData((prev) => {
        const syncEvent: SyncEvent = {
          id: `sy-pe-${Date.now()}`,
          eventUuid: digest(`${id}-${input.name}`).slice(0, 12),
          originNode: "hq-node",
          entity: "personnel",
          op: "create",
          payload: `${input.name}:${input.team}`,
          lamportTs: prev.syncLog.length + 8000,
          priority: "P1",
          bytes: 180,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          personnel: [person, ...prev.personnel],
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      toast.success("Personnel added", {
        description: `${input.name} \u00b7 ${input.role}`,
      });
      return person;
    },
    [link]
  );

  const updatePersonnel = React.useCallback<StoreValue["updatePersonnel"]>(
    (id, patch) => {
      let label = "Roster updated";
      setData((prev) => {
        const person = prev.personnel.find((p) => p.id === id);
        if (!person) return prev;
        const nextStation =
          "stationId" in patch ? patch.stationId : person.stationId;
        const nextState = patch.state ?? person.state;
        label = `${person.name} \u00b7 ${nextState.replaceAll("_", " ")}`;
        const updated: Personnel = {
          ...person,
          stationId: nextStation || undefined,
          state: nextState,
        };
        const stationNode = prev.stations.find((s) => s.id === nextStation);
        const syncEvent: SyncEvent = {
          id: `sy-pe-up-${Date.now()}`,
          eventUuid: digest(`${id}-${nextState}`).slice(0, 12),
          originNode: `${stationNode?.shortName ?? "hq"}-edge`,
          entity: "personnel",
          op: "update",
          payload: `${person.name}:${nextState}`,
          lamportTs: prev.syncLog.length + 8400,
          priority: "P1",
          bytes: 120,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          personnel: prev.personnel.map((p) => (p.id === id ? updated : p)),
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      toast.message("Personnel reassigned", { description: label });
    },
    [link]
  );

  const createConsignment = React.useCallback<StoreValue["createConsignment"]>(
    (input) => {
      const id = `cs-${Date.now()}`;
      const qrCode = `POLAR-${String(Date.now()).slice(-6)}`;
      const consignment: Consignment = {
        id,
        qrCode,
        expeditionId: input.expeditionId,
        description: input.description,
        originStationId: input.originStationId,
        destinationStationId: input.destinationStationId,
        category: input.category,
        weightKg: input.weightKg,
        volumeM3:
          input.volumeM3 ?? Math.round((input.weightKg / 250) * 10) / 10,
        priority:
          input.priority ??
          (input.category === "medical"
            ? "P0"
            : input.category === "waste"
              ? "P2"
              : "P1"),
        hazmatClass: input.hazmatClass,
        tempReq: input.tempReq,
        status: "PLANNED",
      };
      setData((prev) => {
        const station = prev.stations.find(
          (s) => s.id === input.originStationId
        );
        const ts = new Date().toISOString();
        const actor = "HQ Logistics Officer";
        const event: CustodyEvent = {
          id: `ce-${id}-0`,
          consignmentId: id,
          legId: undefined,
          stationId: input.originStationId,
          eventType: "scan:planned",
          fromState: "NEW",
          toState: "PLANNED",
          scannedBy: actor,
          ts,
          lat: station?.lat ?? 0,
          lon: station?.lon ?? 0,
          prevHash: GENESIS_HASH,
          hash: digest(
            GENESIS_HASH,
            id,
            "PLANNED",
            ts,
            input.originStationId,
            actor
          ),
        };
        const syncEvent: SyncEvent = {
          id: `sy-cs-${Date.now()}`,
          eventUuid: digest(`${id}-${qrCode}`).slice(0, 12),
          originNode: "hq-node",
          entity: "consignment",
          op: "create",
          payload: `${qrCode}:${input.category}`,
          lamportTs: prev.syncLog.length + 8500,
          priority: consignment.priority,
          bytes: 210,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          consignments: [consignment, ...prev.consignments],
          custody: [...prev.custody, event],
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      toast.success("Consignment created", {
        description: `${qrCode} \u00b7 ${input.description}`,
      });
      return consignment;
    },
    [link]
  );

  const raiseIncident = React.useCallback<StoreValue["raiseIncident"]>((input) => {
    const incident: Incident = {
      id: `in-${Date.now()}`,
      ...input,
      reportedBy: "HQ Duty Officer",
      status: "RAISED",
      createdAt: new Date().toISOString(),
    };
    setData((prev) => {
      const sosEvent: SyncEvent = {
        id: `sy-sos-${Date.now()}`,
        eventUuid: digest(incident.id).slice(0, 12),
        originNode: `${prev.stations.find((s) => s.id === input.stationId)?.shortName ?? "edge"}-edge`,
        entity: "incident",
        op: "create",
        payload: `${input.type}:${input.severity}`,
        lamportTs: prev.syncLog.length + 9000,
        priority: "P0",
        bytes: 74,
        appliedAt: link === "offline" ? undefined : new Date().toISOString(),
      };
      return {
        ...prev,
        incidents: [incident, ...prev.incidents],
        syncLog: [sosEvent, ...prev.syncLog].slice(0, 60),
      };
    });
    toast.error("SOS raised \u2014 P0 lane", {
      description:
        link === "offline"
          ? "Buffered locally on the P0 lane; it transmits the moment the link returns."
          : link === "throttled"
            ? "Compact SOS packet (74 B) delivered instantly while bulk data queues."
            : "Incident opened and broadcast to HQ duty officer.",
    });
    return incident;
  }, [link]);

  const advanceIncident = React.useCallback(
    (incidentId: ID, status: Incident["status"], action: string) => {
      setData((prev) => ({
        ...prev,
        incidents: prev.incidents.map((i) => (i.id === incidentId ? { ...i, status } : i)),
        incidentActions: [
          ...prev.incidentActions,
          {
            id: `ia-${Date.now()}`,
            incidentId,
            action,
            by: "HQ Duty Officer",
            ts: new Date().toISOString(),
          },
        ],
      }));
      toast.message(`Incident \u2192 ${status.replaceAll("_", " ")}`, { description: action });
    },
    []
  );

  const logMaintenance = React.useCallback(
    (assetId: ID, action: string, notes?: string) => {
      setData((prev) => ({
        ...prev,
        maintenance: [
          {
            id: `ml-${Date.now()}`,
            assetId,
            action,
            by: "HQ Logistics Officer",
            ts: new Date().toISOString(),
            notes,
          },
          ...prev.maintenance,
        ],
        groundAssets: prev.groundAssets.map((a) =>
          a.id === assetId
            ? {
                ...a,
                lastService: new Date().toISOString(),
                nextMaintenance: new Date(Date.now() + 90 * 86400000).toISOString(),
                condition: "good",
              }
            : a
        ),
      }));
      toast.success("Maintenance logged", { description: action });
    },
    []
  );

  const addAsset = React.useCallback<StoreValue["addAsset"]>(
    (input) => {
      const id = `ga-${Date.now()}`;
      const tag = `NCP-${(input.type.trim() || "AST")
        .slice(0, 3)
        .toUpperCase()}-${100 + data.groundAssets.length}`;
      const asset: Asset = {
        id,
        tag,
        name: input.name,
        type: input.type,
        stationId: input.stationId,
        condition: input.condition ?? "good",
        hoursRun: input.hoursRun ?? 0,
        nextMaintenance: new Date(
          Date.now() + (input.nextMaintenanceDays ?? 90) * 86400000
        ).toISOString(),
        lastService: new Date().toISOString(),
      };
      setData((prev) => {
        const syncEvent: SyncEvent = {
          id: `sy-asset-${Date.now()}`,
          eventUuid: digest(`${id}-asset`).slice(0, 12),
          originNode: `${prev.stations.find((s) => s.id === input.stationId)?.shortName ?? "edge"}-edge`,
          entity: "asset",
          op: "create",
          payload: `${tag}:${input.type}`,
          lamportTs: prev.syncLog.length + 14000,
          priority: "P1",
          bytes: 180,
          appliedAt: link === "offline" ? undefined : new Date().toISOString(),
        };
        return {
          ...prev,
          groundAssets: [asset, ...prev.groundAssets],
          syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
        };
      });
      toast.success("Asset added", {
        description: `${tag} \u00b7 ${input.name}`,
      });
      return asset;
    },
    [data.groundAssets.length, link]
  );

  const setWasteStage = React.useCallback((id: ID, stage: WasteEntry["stage"]) => {
    setData((prev) => ({
      ...prev,
      waste: prev.waste.map((w) =>
        w.id === id ? { ...w, stage, updatedAt: new Date().toISOString() } : w
      ),
    }));
  }, []);

  const verifyChain = React.useCallback(
    (consignmentId: ID) => {
      const chain = data.custody
        .filter((c) => c.consignmentId === consignmentId)
        .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
      let prev = GENESIS_HASH;
      for (const ev of chain) {
        const expected = digest(prev, ev.consignmentId, ev.toState, ev.ts, ev.stationId, ev.scannedBy);
        if (ev.prevHash !== prev || ev.hash !== expected) {
          return { ok: false, brokenAt: ev.id };
        }
        prev = ev.hash;
      }
      return { ok: true };
    },
    [data.custody]
  );

  const tamperCustody = React.useCallback((consignmentId: ID) => {
    setData((prev) => {
      const chain = prev.custody
        .filter((c) => c.consignmentId === consignmentId)
        .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
      const last = chain[chain.length - 1];
      if (!last) return prev;
      const cs = prev.consignments.find((c) => c.id === consignmentId);
      const alert: Alert = {
        id: `al-tamper-${Date.now()}`,
        kind: "scan",
        severity: "critical",
        title: `Custody chain tampered \u00b7 ${cs?.qrCode ?? consignmentId}`,
        detail: `A signed custody record for ${cs?.description ?? "a consignment"} was edited out-of-band; hash verification will fail.`,
        stationId: cs?.destinationStationId,
        ts: new Date().toISOString(),
      };
      return {
        ...prev,
        custody: prev.custody.map((c) =>
          c.id === last.id ? { ...c, hash: digest("tampered", c.id) } : c
        ),
        alerts: [alert, ...prev.alerts].slice(0, 30),
      };
    });
    toast.error("Custody record edited out-of-band", {
      description: "The stored hash no longer matches the chain \u2014 verification will catch it.",
    });
  }, []);

  const pushSync = React.useCallback(
    (priority: SyncPriority, entity: string, op: SyncEvent["op"], payload: string) => {
      setData((prev) => ({
        ...prev,
        syncLog: [
          {
            id: `sy-manual-${Date.now()}`,
            eventUuid: digest(`${entity}-${Date.now()}`).slice(0, 12),
            originNode: "maitri-edge",
            entity,
            op,
            payload,
            lamportTs: prev.syncLog.length + 10000,
            priority,
            bytes: priority === "P0" ? 74 : priority === "P1" ? 420 : 24000,
            appliedAt: link === "offline" ? undefined : new Date().toISOString(),
          },
          ...prev.syncLog,
        ].slice(0, 60),
      }));
    },
    [link]
  );

  const drainSync = React.useCallback((budgetBytes: number) => {
    const order: SyncPriority[] = ["P0", "P1", "P2"];
    const pending = data.syncLog
      .filter((s) => !s.appliedAt)
      .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority) || a.lamportTs - b.lamportTs);
    const allowed = new Set<ID>();
    let bytes = 0;
    for (const ev of pending) {
      if (bytes + ev.bytes > budgetBytes && allowed.size > 0) break;
      bytes += ev.bytes;
      allowed.add(ev.id);
    }
    setData((prev) => ({
      ...prev,
      syncLog: prev.syncLog.map((s) =>
        allowed.has(s.id) ? { ...s, appliedAt: new Date().toISOString() } : s
      ),
    }));
    toast.success("Sync window flushed", {
      description: `${allowed.size} events reconciled within a ${(budgetBytes / 1024).toFixed(1)} KB budget, P0 first.`,
    });
  }, [data.syncLog]);

  const resetDemo = React.useCallback(() => {
    setData(buildSeed());
    setSimulation(null);
    toast.message("Demo data reset", { description: "Synthetic NCPOR seed regenerated." });
  }, []);

  const createExpedition = React.useCallback<StoreValue["createExpedition"]>((input) => {
    const id = `ex-${Date.now()}`;
    const expedition: Expedition = {
      id,
      code: input.code,
      name: input.name,
      type: input.type,
      seasonStart: input.seasonStart,
      seasonEnd: input.seasonEnd,
      status: input.status ?? "planning",
    };
    setData((prev) => {
      const syncEvent: SyncEvent = {
        id: `sy-exp-${Date.now()}`,
        eventUuid: digest(`${id}-${input.code}`).slice(0, 12),
        originNode: "hq-node",
        entity: "expedition",
        op: "create",
        payload: `${input.code}:${input.type}`,
        lamportTs: prev.syncLog.length + 12000,
        priority: "P1",
        bytes: 220,
        appliedAt: link === "offline" ? undefined : new Date().toISOString(),
      };
      return {
        ...prev,
        expeditions: [...prev.expeditions, expedition],
        syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
      };
    });
    toast.success("Expedition created", { description: `${input.code} · ${input.name}` });
    return expedition;
  }, [link]);

  const addLeg = React.useCallback<StoreValue["addLeg"]>((input) => {
    const id = `lg-${Date.now()}`;
    const leg: Leg = {
      id,
      expeditionId: input.expeditionId,
      fromStationId: input.fromStationId,
      toStationId: input.toStationId,
      assetId: input.assetId,
      mode: input.mode,
      plannedDepart: input.plannedDepart,
      plannedArrive: input.plannedArrive,
      seasonOnly: true,
      status: "planned",
    };
    setData((prev) => {
      const syncEvent: SyncEvent = {
        id: `sy-leg-${Date.now()}`,
        eventUuid: digest(`${id}-leg`).slice(0, 12),
        originNode: "hq-node",
        entity: "leg",
        op: "create",
        payload: input.mode,
        lamportTs: prev.syncLog.length + 13000,
        priority: "P1",
        bytes: 160,
        appliedAt: link === "offline" ? undefined : new Date().toISOString(),
      };
      return {
        ...prev,
        legs: [...prev.legs, leg],
        syncLog: [syncEvent, ...prev.syncLog].slice(0, 60),
      };
    });
    toast.success("Leg added", { description: `${input.mode} leg scheduled` });
    return leg;
  }, [link]);

  const value: StoreValue = {
    data,
    stationById,
    today,
    role,
    setRole,
    authed,
    login,
    logout,
    can,
    canPage,
    inScope,
    scope,
    setScope,
    link,
    setLink: setLinkState,
    glare,
    setGlare,
    autonomy,
    nextResupplyDays,
    forecast,
    anomalies,
    scanConsignment,
    addInventoryTxn,
    addInventoryItem,
    addPersonnel,
    updatePersonnel,
    createConsignment,
    raiseIncident,
    advanceIncident,
    logMaintenance,
    addAsset,
    setWasteStage,
    simulate: setSimulation,
    simulation,
    verifyChain,
    tamperCustody,
    scanTicker,
    pushSync,
    drainSync,
    resetDemo,
    createExpedition,
    addLeg,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
