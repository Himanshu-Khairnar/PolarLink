"use client";

import * as React from "react";
import { toast } from "sonner";
import { buildSeed, consumptionSeries, type Dataset, TODAY } from "@/lib/data/seed";
import { digest, GENESIS_HASH } from "@/lib/hash";
import {
  computeAutonomy,
  detectAnomalies,
  type ForecastPoint,
  forecastSeries,
} from "@/lib/engine";
import type {
  AutonomyRow,
  ConsignmentStatus,
  CustodyEvent,
  ID,
  Incident,
  InventoryTxn,
  Role,
  SimulationResult,
  SyncEvent,
  SyncPriority,
  WasteEntry,
} from "@/lib/types";

export type LinkMode = "online" | "throttled" | "offline";

export interface StoreValue {
  data: Dataset;
  today: Date;
  role: Role;
  setRole: (r: Role) => void;
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
  raiseIncident: (input: {
    type: Incident["type"];
    severity: Incident["severity"];
    stationId: ID;
    personId?: ID;
    summary: string;
  }) => Incident;
  advanceIncident: (incidentId: ID, status: Incident["status"], action: string) => void;
  logMaintenance: (assetId: ID, action: string, notes?: string) => void;
  setWasteStage: (id: ID, stage: WasteEntry["stage"]) => void;
  simulate: (result: SimulationResult | null) => void;
  simulation: SimulationResult | null;
  verifyChain: (consignmentId: ID) => { ok: boolean; brokenAt?: string };
  tamperCustody: (consignmentId: ID) => void;
  scanTicker: number;
  pushSync: (priority: SyncPriority, entity: string, op: SyncEvent["op"], payload: string) => void;
  drainSync: (budgetBytes: number) => void;
  resetDemo: () => void;
}

const StoreContext = React.createContext<StoreValue | null>(null);

const ROLE_SCOPE: Record<Role, ID | "all"> = {
  hq_logistics: "all",
  expedition_leader: "all",
  station_leader: "st-maitri",
  inventory_keeper: "st-bharati",
  medical_officer: "st-bharati",
  ship_air_ops: "st-ship",
  member: "st-maitri",
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<Dataset>(() => buildSeed());
  const [role, setRoleState] = React.useState<Role>("hq_logistics");
  const [scope, setScope] = React.useState<ID | "all">("all");
  const [link, setLinkState] = React.useState<LinkMode>("online");
  const [glare, setGlare] = React.useState(false);
  const [simulation, setSimulation] = React.useState<SimulationResult | null>(null);
  const [scanTicker, setScanTicker] = React.useState(0);
  const today = React.useMemo(() => TODAY, []);

  const setRole = React.useCallback((r: Role) => {
    setRoleState(r);
    setScope(ROLE_SCOPE[r]);
  }, []);

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
      return {
        ...prev,
        custody: prev.custody.map((c) =>
          c.id === last.id ? { ...c, hash: digest("tampered", c.id) } : c
        ),
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

  const value: StoreValue = {
    data,
    today,
    role,
    setRole,
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
    raiseIncident,
    advanceIncident,
    logMaintenance,
    setWasteStage,
    simulate: setSimulation,
    simulation,
    verifyChain,
    tamperCustody,
    scanTicker,
    pushSync,
    drainSync,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
