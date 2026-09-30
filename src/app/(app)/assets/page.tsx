"use client";

import * as React from "react";
import { CalendarClock, Gauge, Plus, Wrench } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  Pill,
  Bar,
} from "@/app/components/shared/kit";
import { Field } from "@/app/components/shared/field";
import { Button } from "@/app/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { fmtDate, title } from "@/lib/format";
import type { Asset } from "@/lib/types";

const CONDITION_TONE: Record<Asset["condition"], string> = {
  good: "border-border bg-muted text-muted-foreground",
  fair: "border-primary/15 bg-primary/5 text-foreground/70",
  needs_attention: "border-primary/30 bg-primary/10 text-foreground/80",
  down: "border-primary bg-primary text-primary-foreground",
};

export default function AssetsPage() {
  const { data, stationById, today, inScope, can } = useStore();
  const [selected, setSelected] = React.useState<Asset | null>(null);
  const [filter, setFilter] = React.useState<"all" | "attention" | "due">(
    "all",
  );

  const scopedAssets = data.groundAssets.filter((a) => inScope(a.stationId));
  const scopedIds = new Set(scopedAssets.map((a) => a.id));
  const scopedMaintenance = data.maintenance.filter((m) =>
    scopedIds.has(m.assetId),
  );

  const attention = scopedAssets.filter(
    (a) => a.condition === "down" || a.condition === "needs_attention",
  );
  const dueSoon = scopedAssets.filter(
    (a) => Date.parse(a.nextMaintenance) - today.getTime() < 7 * 86400000,
  );
  const visible =
    filter === "attention"
      ? attention
      : filter === "due"
        ? dueSoon
        : scopedAssets;

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat
          label="Tracked assets"
          value={scopedAssets.length}
          icon={<Wrench className="size-4" />}
          hint="Across 3 stations"
          onClick={() => setFilter("all")}
          active={filter === "all"}
        />
        <Stat
          label="Needs attention"
          value={attention.length}
          tone={attention.length ? "watch" : "ok"}
          icon={<Gauge className="size-4" />}
          hint={
            attention
              .map((d) => d.name)
              .slice(0, 2)
              .join(", ") || "All healthy"
          }
          onClick={() =>
            setFilter((f) => (f === "attention" ? "all" : "attention"))
          }
          active={filter === "attention"}
        />
        <Stat
          label="Service due ≤ 7d"
          value={dueSoon.length}
          tone={dueSoon.length ? "watch" : "ok"}
          icon={<CalendarClock className="size-4" />}
          hint={
            dueSoon
              .map((d) => d.tag)
              .slice(0, 2)
              .join(", ") || "None"
          }
          onClick={() => setFilter((f) => (f === "due" ? "all" : "due"))}
          active={filter === "due"}
        />
        <Stat
          label="Service logs"
          value={scopedMaintenance.length}
          tone="ok"
          icon={<Wrench className="size-4" />}
          hint="Audit-ready"
          onClick={() =>
            document
              .getElementById("maintenance-history")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      </StatStrip>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{visible.length}</span>{" "}
          of {scopedAssets.length} assets
          {filter !== "all" ? (
            <span>
              {" "}
              ·{" "}
              {filter === "attention" ? "needs attention" : "service due ≤ 7d"}
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          {filter !== "all" ? (
            <Button variant="ghost" size="xs" onClick={() => setFilter("all")}>
              Clear filter
            </Button>
          ) : null}
          {can("assets.create") ? <AddAssetDialog /> : null}
        </div>
      </div>

      <div className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((a) => {
          const station = stationById.get(a.stationId);
          const daysToService = Math.round(
            (Date.parse(a.nextMaintenance) - today.getTime()) / 86400000,
          );
          const overdue = daysToService < 0;
          return (
            <SectionCard
              key={a.id}
              className="rounded-none shadow-none ring-0"
              title={a.name}
              description={`${a.type} · ${a.tag}`}
              action={
                <Pill className={CONDITION_TONE[a.condition]}>
                  {title(a.condition)}
                </Pill>
              }
            >
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-center">
                <Field
                  variant="plain"
                  className="bg-card px-2 py-2"
                  label="Station"
                  value={station?.shortName ?? "—"}
                />
                <Field
                  variant="plain"
                  className="bg-card px-2 py-2"
                  label="Hours"
                  value={a.hoursRun.toLocaleString("en-IN")}
                />
                <Field
                  variant="plain"
                  className="bg-card px-2 py-2"
                  label="Next svc"
                  value={
                    overdue
                      ? `${Math.abs(daysToService)}d over`
                      : `${daysToService}d`
                  }
                  valueClassName={
                    overdue
                      ? "text-primary"
                      : daysToService < 7
                        ? "text-primary/70"
                        : undefined
                  }
                />
              </div>
              <Bar
                value={Math.max(0, 90 - daysToService)}
                max={90}
                className="mt-3"
                barClassName={
                  overdue
                    ? "bg-primary"
                    : daysToService < 7
                      ? "bg-primary/50"
                      : "bg-primary/25"
                }
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Last service {a.lastService ? fmtDate(a.lastService) : "—"}
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!can("assets.service")}
                  title={
                    can("assets.service")
                      ? undefined
                      : "Your role cannot log maintenance"
                  }
                  onClick={() => setSelected(a)}
                >
                  Log service
                </Button>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <div id="maintenance-history" className="scroll-mt-20">
        <SectionCard
          title="Maintenance history"
          description="Every intervention is logged against the asset"
          contentClassName="px-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedMaintenance.map((m) => {
                const asset = data.groundAssets.find((a) => a.id === m.assetId);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{asset?.name}</TableCell>
                    <TableCell>{m.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.by}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(m.ts)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.notes}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      <LogServiceDialog asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function LogServiceDialog({
  asset,
  onClose,
}: {
  asset: Asset | null;
  onClose: () => void;
}) {
  const { logMaintenance } = useStore();
  const [action, setAction] = React.useState("Scheduled service");
  const [notes, setNotes] = React.useState("");
  if (!asset) return null;
  return (
    <Dialog open={Boolean(asset)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>
            {asset.tag} · last service{" "}
            {asset.lastService ? fmtDate(asset.lastService) : "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Action
            </Label>
            <Input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Notes
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Parts replaced, observations…"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              logMaintenance(asset.id, action, notes || undefined);
              onClose();
            }}
          >
            Log maintenance &amp; reset schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ASSET_TYPES = [
  "Snowmobile",
  "Generator",
  "Vehicle",
  "Instrument",
  "Crane",
  "Incinerator",
  "Water plant",
  "Pump",
  "Heater",
  "Antenna",
];

const CONDITIONS: Asset["condition"][] = [
  "good",
  "fair",
  "needs_attention",
  "down",
];

const SELECT_CLS =
  "mt-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

function AddAssetDialog() {
  const { data, addAsset, scope } = useStore();
  const stations = data.stations.filter((s) => s.type === "station");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("Generator");
  const [stationId, setStationId] = React.useState(
    scope !== "all" && stations.some((s) => s.id === scope)
      ? scope
      : (stations[0]?.id ?? ""),
  );
  const [condition, setCondition] = React.useState<Asset["condition"]>("good");
  const [hoursRun, setHoursRun] = React.useState("0");
  const [nextMaintenanceDays, setNextMaintenanceDays] = React.useState("90");

  const valid = name.trim() !== "" && type.trim() !== "" && stationId !== "";

  const submit = () => {
    if (!valid) return;
    addAsset({
      name: name.trim(),
      type: type.trim(),
      stationId,
      condition,
      hoursRun: Math.max(0, Number(hoursRun) || 0),
      nextMaintenanceDays: Math.max(1, Number(nextMaintenanceDays) || 90),
    });
    setOpen(false);
    setName("");
    setType("Generator");
    setCondition("good");
    setHoursRun("0");
    setNextMaintenanceDays("90");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus /> Add asset
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add asset</DialogTitle>
          <DialogDescription>
            Registers field equipment against a station and opens a service
            schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cummins 250 kVA"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Type
              </Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={SELECT_CLS}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Station
              </Label>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className={SELECT_CLS}
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Condition
              </Label>
              <select
                value={condition}
                onChange={(e) =>
                  setCondition(e.target.value as Asset["condition"])
                }
                className={SELECT_CLS}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {title(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Hours run
              </Label>
              <Input
                value={hoursRun}
                onChange={(e) => setHoursRun(e.target.value)}
                type="number"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Service in (days)
              </Label>
              <Input
                value={nextMaintenanceDays}
                onChange={(e) => setNextMaintenanceDays(e.target.value)}
                type="number"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <Button className="w-full" disabled={!valid} onClick={submit}>
            Add asset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
