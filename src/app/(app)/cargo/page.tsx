"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Package,
  ScanLine,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatCard, Pill, EmptyState } from "@/components/shared/kit";
import { StageFlow } from "@/components/shared/stage-flow";
import { Field } from "@/components/shared/field";
import { QrTag } from "@/components/shared/qr-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime, title } from "@/lib/format";
import { cn } from "cn";
import type { ConsignmentStatus, CargoCategory, ID } from "@/lib/types";

const FLOW: ConsignmentStatus[] = [
  "PLANNED",
  "PACKED_GOA",
  "IN_TRANSIT_TO_PORT",
  "AT_PORT",
  "AT_HUB",
  "LOADED",
  "OFFLOADED",
  "RECEIVED_STATION",
  "CONSUMED",
];

const NEXT_STATION: Partial<Record<ConsignmentStatus, ID>> = {
  PLANNED: "st-hq",
  PACKED_GOA: "st-hq",
  IN_TRANSIT_TO_PORT: "st-hq",
  AT_PORT: "st-mum",
  AT_HUB: "st-cpt",
  LOADED: "st-ship",
  OFFLOADED: "st-cpt",
};

const CATEGORIES: (CargoCategory | "all")[] = ["all", "food", "fuel", "medical", "spares", "scientific", "waste"];

const CAT_TONE: Record<CargoCategory, string> = {
  food: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  fuel: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  medical: "bg-red-500/15 text-red-500 border-red-500/30",
  spares: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  scientific: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  waste: "bg-muted text-muted-foreground border-border",
};

export default function CargoPage() {
  const { data, anomalies, stationById } = useStore();
  const [cat, setCat] = React.useState<CargoCategory | "all">("all");
  const [selected, setSelected] = React.useState<ID | null>(null);

  const filtered = data.consignments.filter((c) => cat === "all" || c.category === cat);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Consignments" value={data.consignments.length} icon={<Package className="size-4" />} hint="46-ISEA + Arctic" />
        <StatCard label="In transit" value={data.consignments.filter((c) => ["IN_TRANSIT_TO_PORT", "AT_HUB", "LOADED"].includes(c.status)).length} icon={<Truck className="size-4" />} hint="Across the chain" />
        <StatCard label="Custody events" value={data.custody.length} icon={<ScanLine className="size-4" />} hint="Hash-chained scans" tone="ok" />
        <StatCard
          label="Dwell anomalies"
          value={anomalies.length}
          icon={<AlertTriangle className="size-4" />}
          tone={anomalies.length ? "watch" : "ok"}
          hint="Robust z-score > 3.5"
        />
      </div>

      <Tabs value={cat} onValueChange={(v) => setCat(v as CargoCategory | "all")}>
        <TabsList className="flex-wrap">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c} className="capitalize">
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard title="Cargo register" description="Scan-first chain of custody across every hand-off" contentClassName="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>QR tag</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const from = stationById.get(c.originStationId);
              const to = stationById.get(c.destinationStationId);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c.id)}>
                  <TableCell className="font-mono text-xs">{c.qrCode}</TableCell>
                  <TableCell className="max-w-52 truncate font-medium">{c.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {from?.shortName} <ChevronRight className="inline size-3" /> {to?.shortName}
                  </TableCell>
                  <TableCell>
                    <Pill className={cn("capitalize", CAT_TONE[c.category])}>{c.category}</Pill>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.weightKg.toLocaleString("en-IN")} kg</TableCell>
                  <TableCell>
                    <Pill variant="muted">{title(c.status)}</Pill>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <CustodyDialog key={selected ?? "none"} consignmentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CustodyDialog({ consignmentId, onClose }: { consignmentId: ID | null; onClose: () => void }) {
  const { data, stationById, scanConsignment, verifyChain, tamperCustody } = useStore();
  const cs = data.consignments.find((c) => c.id === consignmentId) ?? null;
  const [actor, setActor] = React.useState("Field operator");
  const [verify, setVerify] = React.useState<{ ok: boolean; brokenAt?: string } | null>(null);

  if (!cs) return null;

  const chain = data.custody
    .filter((c) => c.consignmentId === cs.id)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const flowIdx = FLOW.indexOf(cs.status);
  const nextState = flowIdx >= 0 && flowIdx < FLOW.length - 1 ? FLOW[flowIdx + 1] : null;
  const nextStation = nextState ? NEXT_STATION[nextState] ?? cs.destinationStationId : cs.destinationStationId;

  return (
    <Dialog open={Boolean(consignmentId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cs.description}
            <Pill className={cn("capitalize", CAT_TONE[cs.category])}>{cs.category}</Pill>
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{cs.qrCode}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="space-y-3">
            <QrTag value={cs.qrCode} size={132} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field valueClassName="truncate" label="Weight" value={`${cs.weightKg.toLocaleString("en-IN")} kg`} />
              <Field valueClassName="truncate" label="Volume" value={`${cs.volumeM3} m³`} />
              <Field valueClassName="truncate" label="Priority" value={cs.priority} />
              <Field valueClassName="truncate" label="Hazmat" value={cs.hazmatClass ?? "—"} />
              <Field valueClassName="truncate" label="Temp" value={cs.tempReq ?? "Ambient"} />
              <Field
                valueClassName="truncate"
                label="Route"
                value={`${stationById.get(cs.originStationId)?.shortName} → ${stationById.get(cs.destinationStationId)?.shortName}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lifecycle</p>
              <StageFlow steps={FLOW} activeIndex={flowIdx} />
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="actor" className="text-[10px] text-muted-foreground uppercase">Scanned by</Label>
                  <Input id="actor" value={actor} onChange={(e) => setActor(e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
                <Button
                  size="sm"
                  disabled={!nextState}
                  onClick={() => {
                    if (!nextState) return;
                    scanConsignment(cs.id, nextState, nextStation, actor);
                    setVerify(null);
                  }}
                  className="gap-1.5"
                >
                  <ScanLine /> Scan → {nextState ? title(nextState) : "Complete"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Illegal state jumps are rejected; each accepted scan appends a hash-chained custody event.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Custody ledger</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="xs" onClick={() => setVerify(verifyChain(cs.id))} className="gap-1">
                    <ShieldCheck /> Verify
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => tamperCustody(cs.id)} className="gap-1 text-red-500">
                    <AlertTriangle /> Tamper test
                  </Button>
                </div>
              </div>

              {verify ? (
                <div
                  className={cn(
                    "mb-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                    verify.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-red-500/30 bg-red-500/10 text-red-500"
                  )}
                >
                  {verify.ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                  {verify.ok
                    ? "Chain intact — every event hashes to its predecessor."
                    : `Chain broken at ${verify.brokenAt}. A record was edited after signing.`}
                </div>
              ) : null}

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {chain.length === 0 ? (
                  <EmptyState title="No scans yet" hint="Scan the tag to open the custody chain." />
                ) : (
                  chain
                    .slice()
                    .reverse()
                    .map((ev) => (
                      <div key={ev.id} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{title(ev.toState)}</span>
                          <span className="text-[10px] text-muted-foreground">{fmtDateTime(ev.ts)} UTC</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {stationById.get(ev.stationId)?.shortName} · {ev.scannedBy} ·{" "}
                          {ev.lat.toFixed(3)}, {ev.lon.toFixed(3)}
                        </p>
                        <p className="mt-1 font-mono text-[10px] break-all text-muted-foreground/70">
                          prev {ev.prevHash.slice(0, 12)}… → hash {ev.hash.slice(0, 12)}…
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
