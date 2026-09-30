"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Package,
  Plus,
  ScanLine,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  Pill,
  EmptyState,
} from "@/app/components/shared/kit";
import { StageFlow } from "@/app/components/shared/stage-flow";
import { Field } from "@/app/components/shared/field";
import { QrTag } from "@/app/components/shared/qr-tag";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useTabParam } from "@/lib/use-tab-param";
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
import { fmtDateTime, title } from "@/lib/format";
import { cn } from "cn";
import type {
  CargoCategory,
  ConsignmentStatus,
  ID,
  SyncPriority,
} from "@/lib/types";

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

const CATEGORIES: (CargoCategory | "all")[] = [
  "all",
  "food",
  "fuel",
  "medical",
  "spares",
  "scientific",
  "waste",
];

const CAT_TONE: Record<CargoCategory, string> = {
  food: "bg-muted text-muted-foreground border-border",
  fuel: "bg-muted text-muted-foreground border-border",
  medical: "bg-muted text-muted-foreground border-border",
  spares: "bg-muted text-muted-foreground border-border",
  scientific: "bg-muted text-muted-foreground border-border",
  waste: "bg-muted text-muted-foreground border-border",
};

export default function CargoPage() {
  const { data, anomalies, stationById, inScope, can } = useStore();
  const [cat, setCat] = useTabParam("category", "all", (v) =>
    (CATEGORIES as string[]).includes(v),
  );
  const [selected, setSelected] = React.useState<ID | null>(null);

  const scoped = data.consignments.filter(
    (c) => inScope(c.originStationId) || inScope(c.destinationStationId),
  );
  const scopedIds = new Set(scoped.map((c) => c.id));
  const scopedCustody = data.custody.filter((c) =>
    scopedIds.has(c.consignmentId),
  );
  const scopedAnomalies = anomalies.filter((a) =>
    scopedIds.has(a.consignmentId),
  );

  const filtered = scoped.filter(
    (c) => cat === "all" || c.category === cat,
  );

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat
          label="Consignments"
          value={scoped.length}
          icon={<Package className="size-4" />}
          hint="46-ISEA + Arctic"
        />
        <Stat
          label="In transit"
          value={
            scoped.filter((c) =>
              ["IN_TRANSIT_TO_PORT", "AT_HUB", "LOADED"].includes(c.status),
            ).length
          }
          icon={<Truck className="size-4" />}
          hint="Across the chain"
        />
        <Stat
          label="Custody events"
          value={scopedCustody.length}
          icon={<ScanLine className="size-4" />}
          hint="Hash-chained scans"
          tone="ok"
        />
        <Stat
          label="Dwell anomalies"
          value={scopedAnomalies.length}
          icon={<AlertTriangle className="size-4" />}
          tone={scopedAnomalies.length ? "watch" : "ok"}
          hint="Robust z-score > 3.5"
        />
      </StatStrip>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={cat} onValueChange={setCat}>
          <TabsList className="flex-wrap">
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c} className="capitalize">
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {can("cargo.create") ? <NewConsignmentDialog /> : null}
      </div>

      <SectionCard
        title="Cargo register"
        description="Scan-first chain of custody across every hand-off"
        contentClassName="px-0"
      >
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
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(c.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {c.qrCode}
                  </TableCell>
                  <TableCell className="max-w-52 truncate font-medium">
                    {c.description}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {from?.shortName} <ChevronRight className="inline size-3" />{" "}
                    {to?.shortName}
                  </TableCell>
                  <TableCell>
                    <Pill className={cn("capitalize", CAT_TONE[c.category])}>
                      {c.category}
                    </Pill>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.weightKg.toLocaleString("en-IN")} kg
                  </TableCell>
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

      <CustodyDialog
        key={selected ?? "none"}
        consignmentId={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CustodyDialog({
  consignmentId,
  onClose,
}: {
  consignmentId: ID | null;
  onClose: () => void;
}) {
  const { data, stationById, scanConsignment, verifyChain, tamperCustody, can } =
    useStore();
  const cs = data.consignments.find((c) => c.id === consignmentId) ?? null;
  const [actor, setActor] = React.useState("Field operator");
  const [verify, setVerify] = React.useState<{
    ok: boolean;
    brokenAt?: string;
  } | null>(null);

  if (!cs) return null;

  const chain = data.custody
    .filter((c) => c.consignmentId === cs.id)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const flowIdx = FLOW.indexOf(cs.status);
  const nextState =
    flowIdx >= 0 && flowIdx < FLOW.length - 1 ? FLOW[flowIdx + 1] : null;
  const nextStation = nextState
    ? (NEXT_STATION[nextState] ?? cs.destinationStationId)
    : cs.destinationStationId;

  return (
    <Dialog open={Boolean(consignmentId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cs.description}
            <Pill className={cn("capitalize", CAT_TONE[cs.category])}>
              {cs.category}
            </Pill>
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {cs.qrCode}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="space-y-3">
            <QrTag value={cs.qrCode} size={132} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field
                valueClassName="truncate"
                label="Weight"
                value={`${cs.weightKg.toLocaleString("en-IN")} kg`}
              />
              <Field
                valueClassName="truncate"
                label="Volume"
                value={`${cs.volumeM3} m³`}
              />
              <Field
                valueClassName="truncate"
                label="Priority"
                value={cs.priority}
              />
              <Field
                valueClassName="truncate"
                label="Hazmat"
                value={cs.hazmatClass ?? "—"}
              />
              <Field
                valueClassName="truncate"
                label="Temp"
                value={cs.tempReq ?? "Ambient"}
              />
              <Field
                valueClassName="truncate"
                label="Route"
                value={`${stationById.get(cs.originStationId)?.shortName} → ${stationById.get(cs.destinationStationId)?.shortName}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Lifecycle
              </p>
              <StageFlow steps={FLOW} activeIndex={flowIdx} />
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1">
                  <Label
                    htmlFor="actor"
                    className="text-[10px] text-muted-foreground uppercase"
                  >
                    Scanned by
                  </Label>
                  <Input
                    id="actor"
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!nextState || !can("cargo.scan")}
                  title={
                    can("cargo.scan")
                      ? undefined
                      : "Your role cannot scan custody events"
                  }
                  onClick={() => {
                    if (!nextState) return;
                    scanConsignment(cs.id, nextState, nextStation, actor);
                    setVerify(null);
                  }}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ScanLine /> Scan →{" "}
                  {nextState ? title(nextState) : "Complete"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Illegal state jumps are rejected; each accepted scan appends a
                hash-chained custody event.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Custody ledger
                </p>
                <div className="flex items-center gap-2">
                  {can("cargo.verify") ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setVerify(verifyChain(cs.id))}
                      className="gap-1"
                    >
                      <ShieldCheck /> Verify
                    </Button>
                  ) : null}
                  {can("cargo.tamper") ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => tamperCustody(cs.id)}
                      className="gap-1 text-foreground/70"
                    >
                      <AlertTriangle /> Tamper test
                    </Button>
                  ) : null}
                </div>
              </div>

              {verify ? (
                <div
                  className={cn(
                    "mb-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                    verify.ok
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-primary/40 bg-primary/10 text-foreground",
                  )}
                >
                  {verify.ok ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  {verify.ok
                    ? "Chain intact — every event hashes to its predecessor."
                    : `Chain broken at ${verify.brokenAt}. A record was edited after signing.`}
                </div>
              ) : null}

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {chain.length === 0 ? (
                  <EmptyState
                    title="No scans yet"
                    hint="Scan the tag to open the custody chain."
                  />
                ) : (
                  chain
                    .slice()
                    .reverse()
                    .map((ev) => (
                      <div key={ev.id} className="rounded-md border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {title(ev.toState)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {fmtDateTime(ev.ts)} UTC
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {stationById.get(ev.stationId)?.shortName} ·{" "}
                          {ev.scannedBy} · {ev.lat.toFixed(3)},{" "}
                          {ev.lon.toFixed(3)}
                        </p>
                        <p className="mt-1 font-mono text-[10px] break-all text-muted-foreground/70">
                          prev {ev.prevHash.slice(0, 12)}… → hash{" "}
                          {ev.hash.slice(0, 12)}…
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

const ALL_CATEGORIES: CargoCategory[] = [
  "food",
  "fuel",
  "medical",
  "spares",
  "scientific",
  "waste",
];

const SELECT_CLS =
  "mt-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

function NewConsignmentDialog() {
  const { data, createConsignment } = useStore();
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<CargoCategory>("food");
  const [origin, setOrigin] = React.useState("st-hq");
  const [destination, setDestination] = React.useState(
    data.stations.find((s) => s.type === "station")?.id ?? "st-maitri",
  );
  const [expeditionId, setExpeditionId] = React.useState(
    data.expeditions[0]?.id ?? "",
  );
  const [weightKg, setWeightKg] = React.useState("100");
  const [volumeM3, setVolumeM3] = React.useState("");
  const [priority, setPriority] = React.useState<SyncPriority>("P1");
  const [hazmatClass, setHazmatClass] = React.useState("");
  const [tempReq, setTempReq] = React.useState("");

  const valid =
    description.trim() !== "" &&
    origin !== destination &&
    (Number(weightKg) || 0) > 0 &&
    expeditionId !== "";

  const submit = () => {
    if (!valid) return;
    createConsignment({
      description: description.trim(),
      category,
      originStationId: origin,
      destinationStationId: destination,
      expeditionId,
      weightKg: Number(weightKg) || 0,
      volumeM3: volumeM3 === "" ? undefined : Number(volumeM3) || 0,
      priority,
      hazmatClass: hazmatClass.trim() || undefined,
      tempReq: tempReq.trim() || undefined,
    });
    setOpen(false);
    setDescription("");
    setCategory("food");
    setOrigin("st-hq");
    setDestination(
      data.stations.find((s) => s.type === "station")?.id ?? "st-maitri",
    );
    setExpeditionId(data.expeditions[0]?.id ?? "");
    setWeightKg("100");
    setVolumeM3("");
    setPriority("P1");
    setHazmatClass("");
    setTempReq("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus /> New consignment
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New consignment</DialogTitle>
          <DialogDescription>
            Registers cargo and opens a hash-chained custody record at origin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Description
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Insulin cold-chain box"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Category
              </Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CargoCategory)}
                className={SELECT_CLS}
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Expedition
              </Label>
              <select
                value={expeditionId}
                onChange={(e) => setExpeditionId(e.target.value)}
                className={SELECT_CLS}
              >
                {data.expeditions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Origin
              </Label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className={SELECT_CLS}
              >
                {data.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Destination
              </Label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={SELECT_CLS}
              >
                {data.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Weight (kg)
              </Label>
              <Input
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                type="number"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Volume (m³)
              </Label>
              <Input
                value={volumeM3}
                onChange={(e) => setVolumeM3(e.target.value)}
                type="number"
                placeholder="auto"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Priority
              </Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SyncPriority)}
                className={SELECT_CLS}
              >
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Hazmat class (optional)
              </Label>
              <Input
                value={hazmatClass}
                onChange={(e) => setHazmatClass(e.target.value)}
                placeholder="Class 3 (flammable liquid)"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Temp requirement (optional)
              </Label>
              <Input
                value={tempReq}
                onChange={(e) => setTempReq(e.target.value)}
                placeholder="2-8 C"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <Button className="w-full" disabled={!valid} onClick={submit}>
            Create consignment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
