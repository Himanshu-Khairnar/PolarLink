"use client";

import * as React from "react";
import { CalendarClock, Gauge, Wrench } from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatStrip, Stat, Pill, Bar } from "@/components/shared/kit";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, title } from "@/lib/format";
import type { Asset } from "@/lib/types";

const CONDITION_TONE: Record<Asset["condition"], string> = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  fair: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  needs_attention: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  down: "border-red-500/30 bg-red-500/10 text-red-500",
};

export default function AssetsPage() {
  const { data, stationById, today } = useStore();
  const [selected, setSelected] = React.useState<Asset | null>(null);

  const dueSoon = data.groundAssets.filter((a) => Date.parse(a.nextMaintenance) - today.getTime() < 7 * 86400000);
  const down = data.groundAssets.filter((a) => a.condition === "down" || a.condition === "needs_attention");

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat label="Tracked assets" value={data.groundAssets.length} icon={<Wrench className="size-4" />} hint="Across 3 stations" />
        <Stat label="Needs attention" value={down.length} tone={down.length ? "watch" : "ok"} icon={<Gauge className="size-4" />} hint={down.map((d) => d.name).slice(0, 2).join(", ") || "All healthy"} />
        <Stat label="Service due ≤ 7d" value={dueSoon.length} tone={dueSoon.length ? "watch" : "ok"} icon={<CalendarClock className="size-4" />} hint={dueSoon.map((d) => d.tag).slice(0, 2).join(", ") || "None"} />
        <Stat label="Service logs" value={data.maintenance.length} tone="ok" icon={<Wrench className="size-4" />} hint="Audit-ready" />
      </StatStrip>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.groundAssets.map((a) => {
          const station = stationById.get(a.stationId);
          const daysToService = Math.round((Date.parse(a.nextMaintenance) - today.getTime()) / 86400000);
          const overdue = daysToService < 0;
          return (
            <SectionCard
              key={a.id}
              title={a.name}
              description={`${a.type} · ${a.tag}`}
              action={<Pill className={CONDITION_TONE[a.condition]}>{title(a.condition)}</Pill>}
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <Field label="Station" value={station?.shortName ?? "—"} />
                <Field label="Hours" value={a.hoursRun.toLocaleString("en-IN")} />
                <Field label="Next svc" value={overdue ? `${Math.abs(daysToService)}d over` : `${daysToService}d`} tone={overdue ? "critical" : daysToService < 7 ? "watch" : "ok"} />
              </div>
              <Bar
                value={Math.max(0, 90 - daysToService)}
                max={90}
                className="mt-3"
                barClassName={overdue ? "bg-red-500" : daysToService < 7 ? "bg-amber-500" : "bg-emerald-500"}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Last service {a.lastService ? fmtDate(a.lastService) : "—"}</span>
                <Button variant="outline" size="xs" onClick={() => setSelected(a)}>
                  Log service
                </Button>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard title="Maintenance history" description="Every intervention is logged against the asset" contentClassName="px-0">
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
            {data.maintenance.map((m) => {
              const asset = data.groundAssets.find((a) => a.id === m.assetId);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{asset?.name}</TableCell>
                  <TableCell>{m.action}</TableCell>
                  <TableCell className="text-muted-foreground">{m.by}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(m.ts)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.notes}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <LogServiceDialog asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function LogServiceDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const { logMaintenance } = useStore();
  const [action, setAction] = React.useState("Scheduled service");
  const [notes, setNotes] = React.useState("");
  if (!asset) return null;
  return (
    <Dialog open={Boolean(asset)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{asset.name}</DialogTitle>
          <DialogDescription>{asset.tag} · last service {asset.lastService ? fmtDate(asset.lastService) : "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">Action</Label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} className="mt-1 h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Parts replaced, observations…" className="mt-1 h-8 text-xs" />
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
