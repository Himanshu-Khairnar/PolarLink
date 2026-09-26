"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, Package, Radio, Ship, Siren, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatCard, Pill, RiskBadge, LiveDot, Bar } from "@/components/shared/kit";
import { Donut, HBars } from "@/components/shared/charts";
import { NetworkMap } from "@/components/shared/network-map";
import { Copilot } from "@/components/shared/copilot";
import { Button } from "@/components/ui/button";
import { relTime, title } from "@/lib/format";
import type { AutonomyRow, ID } from "@/lib/types";
import { cn } from "cn";

export default function DashboardPage() {
  const { data, autonomy, link } = useStore();

  const stations = data.stations;
  const activeStations = stations.filter((s) => s.type === "station");

  const criticalRows = React.useMemo(
    () =>
      Object.entries(autonomy)
        .flatMap(([stationId, rows]) => rows.map((r) => ({ stationId, ...r })))
        .filter((r) => r.risk !== "OK")
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [autonomy]
  );

  const openIncidents = data.incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "REVIEWED");
  const activeConsignments = data.consignments.filter((c) => c.status !== "CONSUMED" && c.status !== "WASTE_RETURNED");
  const inTransitLegs = data.legs.filter((l) => l.status === "in_transit" || l.status === "loading");
  const crewOnStation = data.personnel.filter((p) => p.state === "AT_STATION");

  const statusBuckets = [
    { label: "Planned / packed", value: data.consignments.filter((c) => ["PLANNED", "PACKED_GOA"].includes(c.status)).length },
    { label: "In transit / hub", value: data.consignments.filter((c) => ["IN_TRANSIT_TO_PORT", "AT_PORT", "AT_HUB"].includes(c.status)).length },
    { label: "Loaded / offloaded", value: data.consignments.filter((c) => ["LOADED", "OFFLOADED"].includes(c.status)).length },
    { label: "Retrograde / waste", value: data.consignments.filter((c) => ["RETROGRADE", "WASTE_RETURNED"].includes(c.status)).length },
  ];

  const recentCustody = [...data.custody].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 7);
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Min autonomy"
          value={minAutonomy ? minAutonomy.daysLeft : "—"}
          unit="days"
          tone={minAutonomy?.risk === "CRITICAL" ? "critical" : "watch"}
          hint={minAutonomy ? `${minAutonomy.name} · ${stations.find((s) => s.id === minAutonomy.stationId)?.shortName}` : "All healthy"}
          icon={<Activity className="size-4" />}
        />
        <StatCard label="Active consignments" value={activeConsignments.length} unit={`of ${data.consignments.length}`} icon={<Package className="size-4" />} hint="Multi-leg chain of custody" />
        <StatCard label="Legs underway" value={inTransitLegs.length} unit="legs" icon={<Ship className="size-4" />} hint={inTransitLegs.map((l) => title(l.status)).join(", ") || "Season idle"} />
        <StatCard label="Crew on station" value={crewOnStation.length} unit="people" icon={<Users className="size-4" />} hint={`${crewOnStation.filter((p) => p.team === "winter").length} winter-over`} />
        <StatCard label="Open incidents" value={openIncidents.length} tone={openIncidents.some((i) => i.severity === "critical") ? "critical" : "watch"} unit="live" icon={<Siren className="size-4" />} hint={`${data.incidents.filter((i) => i.type === "medical").length} medical this season`} />
        <StatCard label="Pending sync" value={pendingSync} unit="events" icon={<Radio className="size-4" />} hint={link === "offline" ? "Node buffering locally" : "Lanes draining in order"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Live transport network"
          description="Goa · Mumbai · Cape Town gateway · vessel · Maitri, Bharati & Himadri, with partner stations"
          action={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LiveDot tone={link === "offline" ? "red" : link === "throttled" ? "amber" : "emerald"} />
              {link === "offline" ? "Station buffering" : link === "throttled" ? "Low-bandwidth mode" : "Live via WebSocket"}
            </div>
          }
          contentClassName="p-0"
        >
          <NetworkMap stations={stations} legs={data.legs} className="rounded-t-none" />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Days of Autonomy"
            description="Survival time per station vs. next resupply window"
            action={<Button variant="ghost" size="sm" render={<Link href="/inventory" />}>Open <ArrowUpRight /></Button>}
          >
            <div className="space-y-2.5">
              {relevantRisk(criticalRows).map((r) => {
                const station = stations.find((s) => s.id === r.stationId);
                const pct = Math.min(100, (r.daysLeft / Math.max(r.nextResupplyDays, 1)) * 100);
                return (
                  <div key={`${r.stationId}-${r.itemId}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-xs font-medium">{r.name}</span>
                        <Pill variant="muted">{station?.shortName}</Pill>
                      </div>
                      <RiskBadge risk={r.risk} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Bar
                        value={pct}
                        max={100}
                        barClassName={cn(
                          r.risk === "CRITICAL" ? "bg-red-500" : r.risk === "WATCH" ? "bg-amber-500" : "bg-emerald-500"
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

          <SectionCard title="Station risk board" description="Critical and watch lines per station">
            <div className="space-y-2">
              {stationRisk.map(({ station, critical, watch, top }) => (
                <Link
                  key={station.id}
                  href="/inventory"
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-2.5 rounded-full bg-sky-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{station.shortName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {top ? `Lowest cover: ${top.name} (${top.daysLeft}d)` : "No stock data"}
                    </p>
                  </div>
                  {critical > 0 ? <Pill className="border-red-500/30 bg-red-500/10 text-red-500">{critical} crit</Pill> : null}
                  {watch > 0 ? <Pill className="border-amber-500/30 bg-amber-500/10 text-amber-500">{watch} watch</Pill> : null}
                  {critical === 0 && watch === 0 ? <Pill className="border-emerald-500/30 text-emerald-500">OK</Pill> : null}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Custody pipeline" description="Consignments by chain stage">
          <Donut
            segments={[
              { value: statusBuckets[0].value, className: "text-muted-foreground", label: "Planned / packed" },
              { value: statusBuckets[1].value, className: "text-sky-500", label: "In transit / hub" },
              { value: statusBuckets[2].value, className: "text-emerald-500", label: "Loaded / offloaded" },
              { value: statusBuckets[3].value, className: "text-violet-500", label: "Retrograde" },
            ]}
            centerLabel={`${data.consignments.length}`}
            centerSub="consignments"
          />
        </SectionCard>

        <SectionCard title="Season demand mix" description="Synthetic consumption baseline, units/day" className="xl:col-span-1">
          <HBars
            rows={[
              { label: "Food", value: 108, className: "bg-sky-500" },
              { label: "Diesel", value: 720, className: "bg-amber-500" },
              { label: "Medical", value: 9, className: "bg-red-500" },
              { label: "Spares", value: 3.4, className: "bg-emerald-500" },
              { label: "Scientific", value: 2.1, className: "bg-violet-500" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Live custody feed" description="Hash-chained scan events across the chain">
          <div className="space-y-2.5">
            {recentCustody.map((ev) => {
              const cs = data.consignments.find((c) => c.id === ev.consignmentId);
              const station = stations.find((s) => s.id === ev.stationId);
              return (
                <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Package className="size-3 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{cs?.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ev.toState.replaceAll("_", " ")} · {station?.shortName} · {relTime(ev.ts)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{ev.hash.slice(0, 6)}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Ask PolarLink" description="Natural-language answers grounded in live plan data">
          <Copilot />
        </SectionCard>
      </div>
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
