"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowUpRight,
  FlaskConical,
  Fuel,
  HeartPulse,
  Package,
  Radio,
  Ship,
  Siren,
  Users,
  Utensils,
  Wrench,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  Pill,
  RiskBadge,
  LiveDot,
  Bar,
} from "@/app/components/shared/kit";
import { Button } from "@/app/components/ui/button";

const NetworkMap = dynamic(
  () => import("@/app/components/shared/network-map").then((m) => m.NetworkMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] w-full animate-pulse rounded-lg bg-muted" />
    ),
  },
);

import { RelativeTime } from "@/app/components/shared/relative-time";
import { title } from "@/lib/format";
import type { AutonomyRow, ID } from "@/lib/types";
import { cn } from "cn";

const STAGE_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-5"];

const DEMAND_MIX = [
  {
    label: "Food",
    value: 108,
    icon: Utensils,
    bar: "bg-chart-1",
    tone: "text-chart-1",
  },
  {
    label: "Diesel",
    value: 720,
    icon: Fuel,
    bar: "bg-chart-2",
    tone: "text-chart-2",
  },
  {
    label: "Medical",
    value: 9,
    icon: HeartPulse,
    bar: "bg-chart-3",
    tone: "text-chart-3",
  },
  {
    label: "Spares",
    value: 3.4,
    icon: Wrench,
    bar: "bg-chart-4",
    tone: "text-chart-4",
  },
  {
    label: "Scientific",
    value: 2.1,
    icon: FlaskConical,
    bar: "bg-chart-5",
    tone: "text-chart-5",
  },
];

const DEMAND_MAX = Math.max(...DEMAND_MIX.map((d) => d.value));

export default function DashboardPage() {
  const { data, autonomy, link, stationById, inScope } = useStore();

  const stations = data.stations;
  const activeStations = stations.filter(
    (s) => s.type === "station" && inScope(s.id),
  );

  const scopedConsignments = data.consignments.filter(
    (c) => inScope(c.originStationId) || inScope(c.destinationStationId),
  );
  const scopedLegs = data.legs.filter(
    (l) => inScope(l.fromStationId) || inScope(l.toStationId),
  );
  const scopedIncidents = data.incidents.filter((i) => inScope(i.stationId));
  const scopedCustody = data.custody.filter((c) => inScope(c.stationId));

  const criticalRows = React.useMemo(
    () =>
      Object.entries(autonomy)
        .flatMap(([stationId, rows]) => rows.map((r) => ({ stationId, ...r })))
        .filter((r) => r.risk !== "OK" && inScope(r.stationId))
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [autonomy, inScope],
  );

  const openIncidents = scopedIncidents.filter(
    (i) => i.status !== "RESOLVED" && i.status !== "REVIEWED",
  );
  const activeConsignments = scopedConsignments.filter(
    (c) => c.status !== "CONSUMED" && c.status !== "WASTE_RETURNED",
  );
  const inTransitLegs = scopedLegs.filter(
    (l) => l.status === "in_transit" || l.status === "loading",
  );
  const crewOnStation = data.personnel.filter(
    (p) => p.state === "AT_STATION" && inScope(p.stationId),
  );

  const statusBuckets = [
    {
      label: "Planned / packed",
      value: scopedConsignments.filter((c) =>
        ["PLANNED", "PACKED_GOA"].includes(c.status),
      ).length,
    },
    {
      label: "In transit / hub",
      value: scopedConsignments.filter((c) =>
        ["IN_TRANSIT_TO_PORT", "AT_PORT", "AT_HUB"].includes(c.status),
      ).length,
    },
    {
      label: "Loaded / offloaded",
      value: scopedConsignments.filter((c) =>
        ["LOADED", "OFFLOADED"].includes(c.status),
      ).length,
    },
    {
      label: "Retrograde / waste",
      value: scopedConsignments.filter((c) =>
        ["RETROGRADE", "WASTE_RETURNED"].includes(c.status),
      ).length,
    },
  ];

  const recentCustody = [...scopedCustody]
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, 8);
  const feedColumns = [recentCustody.slice(0, 4), recentCustody.slice(4, 8)];
  const totalConsignments = scopedConsignments.length;
  const minAutonomy = criticalRows[0];
  const pendingSync = data.syncLog.filter((s) => !s.appliedAt).length;

  const stationRisk = activeStations.map((s) => {
    const rows = autonomy[s.id] ?? [];
    return {
      station: s,
      critical: rows.filter((r) => r.risk === "CRITICAL").length,
      watch: rows.filter((r) => r.risk === "WATCH").length,
      top: rows[0],
    };
  });

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <StatStrip cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Min autonomy"
          value={minAutonomy ? minAutonomy.daysLeft : "—"}
          unit="days"
          tone={minAutonomy?.risk === "CRITICAL" ? "critical" : "watch"}
          hint={
            minAutonomy
              ? `${minAutonomy.name} · ${stationById.get(minAutonomy.stationId)?.shortName}`
              : "All healthy"
          }
          icon={<Activity className="size-4" />}
        />
        <Stat
          label="Active consignments"
          value={activeConsignments.length}
          unit={`of ${data.consignments.length}`}
          icon={<Package className="size-4" />}
          hint="Multi-leg chain of custody"
        />
        <Stat
          label="Legs underway"
          value={inTransitLegs.length}
          unit="legs"
          icon={<Ship className="size-4" />}
          hint={
            inTransitLegs.map((l) => title(l.status)).join(", ") ||
            "Season idle"
          }
        />
        <Stat
          label="Crew on station"
          value={crewOnStation.length}
          unit="people"
          icon={<Users className="size-4" />}
          hint={`${crewOnStation.filter((p) => p.team === "winter").length} winter-over`}
        />
        <Stat
          label="Open incidents"
          value={openIncidents.length}
          tone={
            openIncidents.some((i) => i.severity === "critical")
              ? "critical"
              : "watch"
          }
          unit="live"
          icon={<Siren className="size-4" />}
          hint={`${data.incidents.filter((i) => i.type === "medical").length} medical this season`}
        />
        <Stat
          label="Pending sync"
          value={pendingSync}
          unit="events"
          icon={<Radio className="size-4" />}
          hint={
            link === "offline"
              ? "Node buffering locally"
              : "Lanes draining in order"
          }
        />
      </StatStrip>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Live transport network"
          description="Goa · Mumbai · Cape Town gateway · vessel · Maitri, Bharati & Himadri, with partner stations"
          action={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LiveDot
                tone={
                  link === "offline"
                    ? "red"
                    : link === "throttled"
                      ? "amber"
                      : "emerald"
                }
              />
              {link === "offline"
                ? "Station buffering"
                : link === "throttled"
                  ? "Low-bandwidth mode"
                  : "Live via WebSocket"}
            </div>
          }
          contentClassName="p-0"
        >
          <NetworkMap
            stations={stations}
            legs={scopedLegs}
            className="rounded-t-none"
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Days of Autonomy"
            description="Survival time per station vs. next resupply window"
            action={
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/inventory" />}
              >
                Open <ArrowUpRight />
              </Button>
            }
          >
            <div className="space-y-2.5">
              {relevantRisk(criticalRows).map((r) => {
                const station = stationById.get(r.stationId);
                const pct = Math.min(
                  100,
                  (r.daysLeft / Math.max(r.nextResupplyDays, 1)) * 100,
                );
                return (
                  <div
                    key={`${r.stationId}-${r.itemId}`}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-xs font-medium">
                          {r.name}
                        </span>
                        <Pill variant="muted">{station?.shortName}</Pill>
                      </div>
                      <RiskBadge risk={r.risk} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Bar
                        value={pct}
                        max={100}
                        barClassName={cn(
                          r.risk === "CRITICAL"
                            ? "bg-primary"
                            : r.risk === "WATCH"
                              ? "bg-primary/50"
                              : "bg-primary/25",
                        )}
                      />
                      <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                        {r.daysLeft}d / {r.nextResupplyDays}d
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Station risk board"
            description="Critical and watch lines per station"
          >
            <div className="space-y-2">
              {stationRisk.map(({ station, critical, watch, top }) => (
                <Link
                  key={station.id}
                  href="/inventory"
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-2.5 rounded-full bg-primary/40" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {station.shortName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {top
                        ? `Lowest cover: ${top.name} (${top.daysLeft}d)`
                        : "No stock data"}
                    </p>
                  </div>
                  {critical > 0 ? (
                    <Pill className="border-primary/30 bg-primary/10 text-foreground">
                      {critical} crit
                    </Pill>
                  ) : null}
                  {watch > 0 ? (
                    <Pill className="border-primary/20 text-foreground/70">
                      {watch} watch
                    </Pill>
                  ) : null}
                  {critical === 0 && watch === 0 ? (
                    <Pill className="border-border text-muted-foreground">
                      OK
                    </Pill>
                  ) : null}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Custody pipeline"
          description="Consignments flowing through the chain of custody"
          action={
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/cargo" />}
            >
              Open <ArrowUpRight />
            </Button>
          }
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums">
                    {totalConsignments}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    consignments tracked
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeConsignments.length} active · {inTransitLegs.length}{" "}
                  legs in motion
                </p>
              </div>
            </div>

            <div className="flex h-3 w-full gap-1">
              {statusBuckets.map((b, i) => {
                const share = totalConsignments
                  ? (b.value / totalConsignments) * 100
                  : 0;
                return (
                  <div
                    key={b.label}
                    title={`${b.label}: ${b.value}`}
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      STAGE_COLORS[i],
                    )}
                    style={{ width: `${share}%` }}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {statusBuckets.map((b, i) => {
                const share = totalConsignments
                  ? Math.round((b.value / totalConsignments) * 100)
                  : 0;
                return (
                  <div key={b.label} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-[3px]",
                          STAGE_COLORS[i],
                        )}
                      />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {b.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                        {b.value}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {share}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Season demand mix"
          description="Synthetic baseline draw, units/day"
        >
          <div className="space-y-3.5">
            {DEMAND_MIX.map((r) => {
              const pct = Math.max(4, Math.sqrt(r.value / DEMAND_MAX) * 100);
              return (
                <div key={r.label}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md bg-muted",
                        r.tone,
                      )}
                    >
                      <r.icon className="size-3.5" />
                    </span>
                    <span className="flex-1 truncate text-xs font-medium">
                      {r.label}
                    </span>
                    <span className="font-heading text-sm font-semibold tabular-nums">
                      {r.value}
                    </span>
                  </div>
                  <div className="mt-1.5 ml-10 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        r.bar,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Live custody feed"
        description="Hash-chained scan events across the chain"
        action={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/cargo" />}
          >
            Open cargo <ArrowUpRight />
          </Button>
        }
      >
        <div className="grid gap-x-8 md:grid-cols-2">
          {feedColumns.map((column, ci) => (
            <ol key={ci}>
              {column.map((ev, i) => {
                const cs = data.consignments.find(
                  (c) => c.id === ev.consignmentId,
                );
                const station = stationById.get(ev.stationId);
                const last = i === column.length - 1;
                return (
                  <li
                    key={ev.id}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {last ? null : (
                      <span className="absolute top-7 bottom-0 left-3 w-px bg-border" />
                    )}
                    <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
                      <Package className="size-3 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-medium">
                          {cs?.description}
                        </p>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                          {ev.hash.slice(0, 6)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Pill variant="muted">
                          {ev.toState.replaceAll("_", " ")}
                        </Pill>
                        <span>{station?.shortName}</span>
                        <span className="text-border">/</span>
                        <RelativeTime value={ev.ts} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function relevantRisk(rows: (AutonomyRow & { stationId: ID })[]) {
  const seen = new Set<string>();
  const out: typeof rows = [];
  for (const r of rows) {
    const key = r.stationId + r.itemId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= 6) break;
  }
  return out;
}
