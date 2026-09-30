"use client";

import * as React from "react";
import {
  CalendarRange,
  Ship,
  Plane,
  Package,
  Users,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  Pill,
  EmptyState,
} from "@/app/components/shared/kit";
import { Field } from "@/app/components/shared/field";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useTabParam } from "@/lib/use-tab-param";
import { fmtDate, title } from "@/lib/format";
import { cn } from "cn";
import type { Expedition, ID, Leg } from "@/lib/types";

const EXP_TYPE_LABEL: Record<Expedition["type"], string> = {
  antarctic: "Antarctic",
  arctic: "Arctic",
  southern_ocean: "Southern Ocean",
};

const LEG_MODES = [
  "Sea liner",
  "Ice-class ship",
  "IL-76 (DROMLAN)",
  "Basler BT-67",
  "Twin Otter",
  "Road / container",
  "Helicopter",
];

const LEG_STATUS_TONE: Record<string, string> = {
  planned: "bg-muted-foreground/35",
  loading: "bg-primary/40",
  in_transit: "bg-primary/75",
  arrived: "bg-primary/55",
  delayed: "bg-primary/90",
};

export default function ExpeditionsPage() {
  const { data, today } = useStore();
  const [expCode, setExpCode] = useTabParam(
    "expedition",
    data.expeditions[0]?.code ?? "",
    (v) => data.expeditions.some((e) => e.code === v),
  );

  const exp =
    data.expeditions.find((e) => e.code === expCode) ?? data.expeditions[0];

  if (!exp) {
    return (
      <EmptyState
        title="No expeditions"
        hint="No season plan is loaded for this deployment."
      />
    );
  }

  const legs = data.legs.filter((l) => l.expeditionId === exp.id);

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat
          label="Expedition"
          value={exp.code}
          hint={exp.name}
          icon={<CalendarRange className="size-4" />}
        />
        <Stat
          label="Season window"
          value={`${daysLeft(exp.seasonStart, exp.seasonEnd)}`}
          unit="days left"
          hint={`Closes ${fmtDate(exp.seasonEnd)}`}
          icon={<CalendarRange className="size-4" />}
        />
        <Stat
          label="Legs"
          value={legs.length}
          unit="in plan"
          hint={`${legs.filter((l) => l.status === "in_transit").length} underway`}
          icon={<Ship className="size-4" />}
        />
        <Stat
          label="Cargo moved"
          value={Math.round(
            data.consignments
              .filter((c) => c.expeditionId === exp.id)
              .reduce((a, b) => a + b.weightKg, 0) / 1000,
          )}
          unit="tonnes"
          hint={`${data.consignments.filter((c) => c.expeditionId === exp.id).length} consignments`}
          icon={<Package className="size-4" />}
        />
      </StatStrip>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={exp.code} onValueChange={setExpCode}>
          <TabsList>
            {data.expeditions.map((e) => (
              <TabsTrigger key={e.id} value={e.code}>
                {e.code}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <NewExpeditionDialog onCreated={setExpCode} />
      </div>

      <SectionCard
        title="Season timeline"
        description={`${exp.code} · ${fmtDate(exp.seasonStart)} → ${fmtDate(exp.seasonEnd)}`}
        action={<AddLegDialog expeditionId={exp.id} />}
      >
        <Gantt legs={legs} today={today} />
      </SectionCard>

      <LegPanel legs={legs} />
    </div>
  );
}

function LegPanel({ legs }: { legs: Leg[] }) {
  if (!legs.length) {
    return (
      <SectionCard
        title="Transport legs"
        description="Scheduled sea, air and road movements for this expedition"
      >
        <EmptyState
          title="No legs planned"
          hint="Add a leg to open the season timeline."
        />
      </SectionCard>
    );
  }

  return (
    <Card className="[--card-spacing:0px]">
      <div className="-mb-px grid grid-cols-1 [&>*]:border-b [&>*]:border-border sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:last-child]:border-r-0">
        {legs.map((leg) => (
          <LegCell key={leg.id} leg={leg} />
        ))}
      </div>
    </Card>
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
  const times = legs.flatMap((l) => [
    Date.parse(l.plannedDepart),
    Date.parse(l.plannedArrive),
  ]);
  const min = Math.min(...times, today.getTime());
  const max = Math.max(...times);
  const span = max - min || 1;
  const pct = (t: number) => ((t - min) / span) * 100;
  const nowPct = pct(today.getTime());

  return (
    <div className="space-y-3">
      <div className="relative h-6">
        <div className="absolute top-1/2 h-px w-full bg-border" />
        <div
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${nowPct}%` }}
        >
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            TODAY
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {legs.map((l) => {
          const left = pct(Date.parse(l.plannedDepart));
          const right = pct(Date.parse(l.plannedArrive));
          const width = Math.max(right - left, 1.5);
          return (
            <div
              key={l.id}
              className="grid grid-cols-[minmax(80px,160px)_1fr] items-center gap-3"
            >
              <span className="truncate text-xs text-muted-foreground">
                {l.mode}
              </span>
              <div className="relative h-6 rounded-md bg-muted/40">
                <div
                  className={cn(
                    "absolute top-1/2 h-3 -translate-y-1/2 rounded-full",
                    LEG_STATUS_TONE[l.status],
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${fmtDate(l.plannedDepart)} → ${fmtDate(l.plannedArrive)}`}
                />
                <div
                  className="absolute top-0 h-full border-l border-dashed border-primary/40"
                  style={{ left: `${nowPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegCell({ leg }: { leg: Leg }) {
  const { data, stationById } = useStore();
  const from = stationById.get(leg.fromStationId);
  const to = stationById.get(leg.toStationId);
  const asset = data.assets.find((a) => a.id === leg.assetId);
  const manifestCargo = data.consignments.filter((c) => c.legId === leg.id);
  const manifestPeople = data.personnel
    .filter((p) => p.state === "IN_TRANSIT")
    .slice(0, 4);
  const Icon = ["ship"].includes(asset?.type ?? "") ? Ship : Plane;

  return (
    <div className="flex min-w-0 flex-col gap-3 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            {from?.shortName}
            <ArrowRight className="size-3.5 text-muted-foreground" />
            {to?.shortName}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="size-3.5" /> {leg.mode} · {asset?.name}
          </p>
        </div>
        <Pill variant="muted">{title(leg.status)}</Pill>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Field
          variant="plain"
          label="Planned depart"
          value={fmtDate(leg.plannedDepart)}
        />
        <Field
          variant="plain"
          label="Planned arrive"
          value={fmtDate(leg.plannedArrive)}
        />
        <Field
          variant="plain"
          label="Capacity"
          value={`${(asset?.capacityKg ?? 0).toLocaleString("en-IN")} kg`}
        />
        <Field variant="plain" label="Seats" value={`${asset?.seats ?? 0}`} />
      </div>
      <div className="mt-4 flex items-center gap-3 border-t pt-3">
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline" size="sm" className="gap-1.5" />}
          >
            <Package /> Manifest
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Manifest · {from?.shortName} → {to?.shortName}
              </DialogTitle>
              <DialogDescription>
                {leg.mode} · {fmtDate(leg.plannedDepart)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  <Users className="size-3.5" /> Personnel (
                  {manifestPeople.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {manifestPeople.length ? (
                    manifestPeople.map((p) => (
                      <Pill key={p.id} variant="muted">
                        {p.name} · {p.role}
                      </Pill>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No movement assigned.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  <Package className="size-3.5" /> Cargo ({manifestCargo.length}
                  )
                </p>
                <div className="space-y-1.5">
                  {manifestCargo.length ? (
                    manifestCargo.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                      >
                        <span>{c.description}</span>
                        <span className="text-muted-foreground">
                          {c.weightKg.toLocaleString("en-IN")} kg ·{" "}
                          {c.status.replaceAll("_", " ")}
                        </span>
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
          {manifestCargo
            .reduce((a, b) => a + b.weightKg, 0)
            .toLocaleString("en-IN")}{" "}
          kg
        </span>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase">
        {label}
      </Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-popover"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function NewExpeditionDialog({ onCreated }: { onCreated: (code: string) => void }) {
  const { createExpedition } = useStore();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<Expedition["type"]>("antarctic");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  const valid =
    code.trim() !== "" &&
    name.trim() !== "" &&
    start !== "" &&
    end !== "" &&
    Date.parse(end) >= Date.parse(start);

  const submit = () => {
    if (!valid) return;
    const exp = createExpedition({
      code: code.trim(),
      name: name.trim(),
      type,
      seasonStart: start,
      seasonEnd: end,
    });
    onCreated(exp.code);
    setOpen(false);
    setCode("");
    setName("");
    setType("antarctic");
    setStart("");
    setEnd("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus /> New expedition
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create expedition</DialogTitle>
          <DialogDescription>
            Opens a new season plan. Add legs and manifests next.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Code
              </Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="47-ISEA"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <SelectField
              label="Type"
              value={type}
              onChange={(v) => setType(v as Expedition["type"])}
              options={(
                Object.keys(EXP_TYPE_LABEL) as Expedition["type"][]
              ).map((t) => [t, EXP_TYPE_LABEL[t]])}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="47th Indian Scientific Expedition to Antarctica"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Season start
              </Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Season end
              </Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <Button className="w-full" disabled={!valid} onClick={submit}>
            Create expedition
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddLegDialog({ expeditionId }: { expeditionId: ID }) {
  const { data, addLeg } = useStore();
  const [open, setOpen] = React.useState(false);
  const stations = data.stations;
  const [from, setFrom] = React.useState(stations[0]?.id ?? "");
  const [to, setTo] = React.useState(stations[1]?.id ?? "");
  const [assetId, setAssetId] = React.useState(data.assets[0]?.id ?? "");
  const [mode, setMode] = React.useState(LEG_MODES[0]);
  const [depart, setDepart] = React.useState("");
  const [arrive, setArrive] = React.useState("");

  const valid =
    from !== "" &&
    to !== "" &&
    from !== to &&
    assetId !== "" &&
    depart !== "" &&
    arrive !== "" &&
    Date.parse(arrive) >= Date.parse(depart);

  const submit = () => {
    if (!valid) return;
    addLeg({
      expeditionId,
      fromStationId: from,
      toStationId: to,
      assetId,
      mode,
      plannedDepart: depart,
      plannedArrive: arrive,
    });
    setOpen(false);
    setDepart("");
    setArrive("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <Plus /> Add leg
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add leg</DialogTitle>
          <DialogDescription>
            Schedule one transport leg onto this expedition.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="From"
              value={from}
              onChange={setFrom}
              options={stations.map((s) => [s.id, s.shortName])}
            />
            <SelectField
              label="To"
              value={to}
              onChange={setTo}
              options={stations.map((s) => [s.id, s.shortName])}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Asset"
              value={assetId}
              onChange={setAssetId}
              options={data.assets.map((a) => [a.id, a.name])}
            />
            <SelectField
              label="Mode"
              value={mode}
              onChange={setMode}
              options={LEG_MODES.map((m) => [m, m])}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Planned depart
              </Label>
              <Input
                type="date"
                value={depart}
                onChange={(e) => setDepart(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Planned arrive
              </Label>
              <Input
                type="date"
                value={arrive}
                onChange={(e) => setArrive(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <Button className="w-full" disabled={!valid} onClick={submit}>
            Add leg
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
