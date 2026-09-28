"use client";

import * as React from "react";
import { CalendarRange, Ship, Plane, Package, Users, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatStrip, Stat, Pill, EmptyState } from "@/components/shared/kit";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate, title } from "@/lib/format";
import { cn } from "cn";
import type { ID, Leg } from "@/lib/types";

const LEG_STATUS_TONE: Record<string, string> = {
  planned: "bg-muted-foreground/50",
  loading: "bg-amber-500",
  in_transit: "bg-sky-500",
  arrived: "bg-emerald-500",
  delayed: "bg-red-500",
};

export default function ExpeditionsPage() {
  const { data, today } = useStore();
  const [activeExp, setActiveExp] = React.useState<ID>(data.expeditions[0]?.id ?? "");

  const exp = data.expeditions.find((e) => e.id === activeExp) ?? data.expeditions[0];

  if (!exp) {
    return <EmptyState title="No expeditions" hint="No season plan is loaded for this deployment." />;
  }

  const legs = data.legs.filter((l) => l.expeditionId === exp.id);

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat label="Expedition" value={exp.code} hint={exp.name} icon={<CalendarRange className="size-4" />} />
        <Stat
          label="Season window"
          value={`${daysLeft(exp.seasonStart, exp.seasonEnd)}`}
          unit="days left"
          hint={`Closes ${fmtDate(exp.seasonEnd)}`}
          icon={<CalendarRange className="size-4" />}
        />
        <Stat label="Legs" value={legs.length} unit="in plan" hint={`${legs.filter((l) => l.status === "in_transit").length} underway`} icon={<Ship className="size-4" />} />
        <Stat
          label="Cargo moved"
          value={Math.round(
            data.consignments.filter((c) => c.expeditionId === exp.id).reduce((a, b) => a + b.weightKg, 0) / 1000
          )}
          unit="tonnes"
          hint={`${data.consignments.filter((c) => c.expeditionId === exp.id).length} consignments`}
          icon={<Package className="size-4" />}
        />
      </StatStrip>

      <Tabs value={activeExp} onValueChange={(v) => setActiveExp(v as string)}>
        <TabsList>
          {data.expeditions.map((e) => (
            <TabsTrigger key={e.id} value={e.id}>
              {e.code}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard
        title="Season timeline"
        description={`${exp.code} · ${fmtDate(exp.seasonStart)} → ${fmtDate(exp.seasonEnd)}`}
      >
        <Gantt legs={legs} today={today} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {legs.map((leg) => (
          <LegCard key={leg.id} leg={leg} />
        ))}
      </div>
    </div>
  );
}

function daysLeft(start: string, end: string) {
  const e = Date.parse(end);
  const s = Date.parse(start);
  const now = Date.now();
  if (now < s) return Math.round((e - s) / 86400000);
  return Math.max(0, Math.round((e - now) / 86400000));
}

function Gantt({ legs, today }: { legs: Leg[]; today: Date }) {
  if (!legs.length) return null;
  const times = legs.flatMap((l) => [Date.parse(l.plannedDepart), Date.parse(l.plannedArrive)]);
  const min = Math.min(...times, today.getTime());
  const max = Math.max(...times);
  const span = max - min || 1;
  const pct = (t: number) => ((t - min) / span) * 100;
  const nowPct = pct(today.getTime());

  return (
    <div className="space-y-3">
      <div className="relative h-6">
        <div className="absolute top-1/2 h-px w-full bg-border" />
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${nowPct}%` }}>
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">TODAY</span>
        </div>
      </div>
      <div className="space-y-2">
        {legs.map((l) => {
          const left = pct(Date.parse(l.plannedDepart));
          const right = pct(Date.parse(l.plannedArrive));
          const width = Math.max(right - left, 1.5);
          return (
            <div key={l.id} className="grid grid-cols-[minmax(80px,160px)_1fr] items-center gap-3">
              <span className="truncate text-xs text-muted-foreground">{l.mode}</span>
              <div className="relative h-6 rounded-md bg-muted/40">
                <div
                  className={cn("absolute top-1/2 h-3 -translate-y-1/2 rounded-full", LEG_STATUS_TONE[l.status])}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${fmtDate(l.plannedDepart)} → ${fmtDate(l.plannedArrive)}`}
                />
                <div className="absolute top-0 h-full border-l border-dashed border-red-500/60" style={{ left: `${nowPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegCard({ leg }: { leg: Leg }) {
  const { data, stationById } = useStore();
  const from = stationById.get(leg.fromStationId);
  const to = stationById.get(leg.toStationId);
  const asset = data.assets.find((a) => a.id === leg.assetId);
  const manifestCargo = data.consignments.filter((c) => c.legId === leg.id);
  const manifestPeople = data.personnel.filter((p) => p.state === "IN_TRANSIT").slice(0, 4);
  const Icon = ["ship"].includes(asset?.type ?? "") ? Ship : Plane;

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {from?.shortName} <ArrowRight className="size-3.5 text-muted-foreground" /> {to?.shortName}
        </span>
      }
      description={
        <span className="flex items-center gap-2">
          <Icon className="size-3.5" /> {leg.mode} · {asset?.name}
        </span>
      }
      action={<Pill className={cn("border-transparent text-white", LEG_STATUS_TONE[leg.status])}>{title(leg.status)}</Pill>}
    >
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Field variant="plain" label="Planned depart" value={fmtDate(leg.plannedDepart)} />
        <Field variant="plain" label="Planned arrive" value={fmtDate(leg.plannedArrive)} />
        <Field variant="plain" label="Capacity" value={`${(asset?.capacityKg ?? 0).toLocaleString("en-IN")} kg`} />
        <Field variant="plain" label="Seats" value={`${asset?.seats ?? 0}`} />
      </div>
      <div className="mt-4 flex items-center gap-3 border-t pt-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Package /> Manifest
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Manifest · {from?.shortName} → {to?.shortName}</DialogTitle>
              <DialogDescription>{leg.mode} · {fmtDate(leg.plannedDepart)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  <Users className="size-3.5" /> Personnel ({manifestPeople.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {manifestPeople.length ? (
                    manifestPeople.map((p) => (
                      <Pill key={p.id} variant="muted">{p.name} · {p.role}</Pill>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No movement assigned.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  <Package className="size-3.5" /> Cargo ({manifestCargo.length})
                </p>
                <div className="space-y-1.5">
                  {manifestCargo.length ? (
                    manifestCargo.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs">
                        <span>{c.description}</span>
                        <span className="text-muted-foreground">{c.weightKg.toLocaleString("en-IN")} kg · {c.status.replaceAll("_", " ")}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Hold empty.</p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <span className="text-xs text-muted-foreground">
          {manifestCargo.length} consignments ·{" "}
          {manifestCargo.reduce((a, b) => a + b.weightKg, 0).toLocaleString("en-IN")} kg
        </span>
      </div>
    </SectionCard>
  );
}
