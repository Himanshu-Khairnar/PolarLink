"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Boxes,
  Leaf,
  Package,
  Recycle,
  Ship,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatStrip, Stat, Pill } from "@/app/components/shared/kit";
import { Donut, HBars } from "@/app/components/shared/charts";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useTabParam } from "@/lib/use-tab-param";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { RelativeTime } from "@/app/components/shared/relative-time";
import { title } from "@/lib/format";
import { cn } from "cn";
import type { WasteEntry } from "@/lib/types";

const STAGES: WasteEntry["stage"][] = [
  "generated",
  "segregated",
  "packed",
  "loaded",
  "returned",
];

const CATEGORIES: WasteEntry["category"][] = [
  "metal",
  "plastic",
  "hazardous",
  "biological",
  "paper",
  "glass",
];

const CAT_BG: Record<WasteEntry["category"], string> = {
  metal: "bg-chart-4",
  plastic: "bg-chart-1",
  hazardous: "bg-primary",
  biological: "bg-chart-2",
  paper: "bg-chart-3",
  glass: "bg-chart-5",
};

export default function WastePage() {
  const { data, setWasteStage, stationById, inScope, can } = useStore();

  const scopedWaste = data.waste.filter((w) => inScope(w.stationId));

  const wasteStations = data.stations.filter(
    (s) => s.type === "station" && scopedWaste.some((w) => w.stationId === s.id),
  );

  const [stationId, setStationId] = useTabParam(
    "station",
    "all",
    (v) => v === "all" || wasteStations.some((s) => s.id === v),
  );

  const entries =
    stationId === "all"
      ? scopedWaste
      : scopedWaste.filter((w) => w.stationId === stationId);

  const total = entries.reduce((a, b) => a + b.qtyKg, 0);
  const returned = entries
    .filter((w) => w.stage === "returned")
    .reduce((a, b) => a + b.qtyKg, 0);
  const hazardous = entries
    .filter((w) => w.category === "hazardous")
    .reduce((a, b) => a + b.qtyKg, 0);
  const inPipeline = total - returned;
  const compliance = total ? Math.round((returned / total) * 100) : 0;

  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    qty: entries
      .filter((w) => w.category === c)
      .reduce((a, b) => a + b.qtyKg, 0),
  })).filter((c) => c.qty > 0);

  const scoped = stationId === "all";

  return (
    <div className="space-y-4">
      {/* Station scope */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={stationId} onValueChange={setStationId}>
          <TabsList>
            <TabsTrigger value="all">All stations</TabsTrigger>
            {wasteStations.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.shortName}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-[11px] text-muted-foreground">
          {scoped ? "Season-to-date · all stations" : stationById.get(stationId)?.name}
        </span>
      </div>

      <StatStrip>
        <Stat
          label="Waste generated"
          value={Math.round(total / 1000)}
          unit="t"
          icon={<Trash2 className="size-4" />}
          hint="Reverse cargo tracked"
        />
        <Stat
          label="Returned"
          value={Math.round(returned / 1000)}
          unit="t"
          tone="ok"
          icon={<Ship className="size-4" />}
          hint={`${compliance}% removed from the continent`}
        />
        <Stat
          label="In pipeline"
          value={Math.round(inPipeline / 1000)}
          unit="t"
          tone="watch"
          icon={<Package className="size-4" />}
          hint="Awaiting retrograde lift"
        />
        <Stat
          label="Hazardous"
          value={hazardous}
          unit="kg"
          tone={hazardous ? "watch" : "ok"}
          icon={<Leaf className="size-4" />}
          hint="Class 8 batteries, oils"
        />
      </StatStrip>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Reverse-cargo pipeline"
          description="Generated → segregated → packed → loaded → returned"
          action={
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Recycle className="size-3.5" />
              {compliance}% compliant
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {STAGES.map((stage) => {
              const items = entries.filter((w) => w.stage === stage);
              const stageQty = items.reduce((a, b) => a + b.qtyKg, 0);
              return (
                <div
                  key={stage}
                  className="flex flex-col overflow-hidden rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2 border-b bg-card px-2.5 py-2">
                    <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {title(stage)}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {items.length === 0 ? (
                      <p className="rounded-md border border-dashed py-4 text-center text-[10px] text-muted-foreground/70">
                        Empty
                      </p>
                    ) : (
                      items.map((w) => {
                        const idx = STAGES.indexOf(w.stage);
                        return (
                          <div
                            key={w.id}
                            className="rounded-md border bg-card p-2.5 shadow-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "size-2.5 rounded-sm",
                                  CAT_BG[w.category],
                                )}
                              />
                              <span className="text-xs font-medium capitalize">
                                {w.category}
                              </span>
                            </div>
                            <p className="mt-1.5 font-heading text-sm font-semibold tabular-nums">
                              {w.qtyKg.toLocaleString("en-IN")} kg
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <Pill variant="muted">
                                {stationById.get(w.stationId)?.shortName}
                              </Pill>
                              <span className="text-[10px] text-muted-foreground">
                                <RelativeTime value={w.updatedAt} />
                              </span>
                            </div>
                            <div className="mt-2">
                              {idx < STAGES.length - 1 ? (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="w-full"
                                  disabled={!can("waste.advance")}
                                  title={
                                    can("waste.advance")
                                      ? undefined
                                      : "Your role cannot advance waste stages"
                                  }
                                  onClick={() =>
                                    setWasteStage(w.id, STAGES[idx + 1])
                                  }
                                >
                                  Advance <ArrowUpRight />
                                </Button>
                              ) : (
                                <Pill className="border-border bg-muted text-muted-foreground">
                                  removed
                                </Pill>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t px-2.5 py-1.5 text-[10px] text-muted-foreground tabular-nums">
                    {stageQty.toLocaleString("en-IN")} kg
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Return compliance"
            description="Madrid Protocol Annex III obligation"
          >
            <Donut
              segments={[
                {
                  value: Math.round(returned),
                  className: "text-chart-2",
                  swatchClassName: "bg-chart-2",
                  label: "Returned to gateway",
                },
                {
                  value: Math.round(inPipeline),
                  className: "text-chart-1",
                  swatchClassName: "bg-chart-1",
                  label: "Still in pipeline",
                },
              ]}
              centerLabel={`${compliance}%`}
              centerSub="returned"
            />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Waste is reverse cargo with its own custody chain, so removal is
              provable end to end for the Ministry / CAG audit pack.
            </p>
          </SectionCard>

          <SectionCard
            title="Category mix"
            description={`${byCategory.length} active streams`}
            action={<Boxes className="size-4 text-muted-foreground" />}
          >
            <HBars
              rows={byCategory.map((c) => ({
                label: title(c.category),
                value: c.qty,
                className: CAT_BG[c.category],
              }))}
              unit="kg"
            />
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Stage totals"
        description="Where every kilo sits today"
        className="pb-0"
        contentClassName="p-0"
      >
        <div className="grid grid-cols-1 gap-px border-t bg-border sm:grid-cols-5">
          {STAGES.map((s) => {
            const qty = entries
              .filter((w) => w.stage === s)
              .reduce((a, b) => a + b.qtyKg, 0);
            const share = total ? Math.round((qty / total) * 100) : 0;
            return (
              <Stat
                key={s}
                label={title(s)}
                value={qty.toLocaleString("en-IN")}
                unit="kg"
                tone={s === "returned" ? "ok" : "default"}
                hint={
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full transition-[width] duration-500",
                          s === "returned" ? "bg-chart-2" : "bg-primary/60",
                        )}
                        style={{ width: `${Math.max(share, qty ? 3 : 0)}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{share}%</span>
                  </span>
                }
              />
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Ledger entries"
        description="Every movement is appended to the shared event log"
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Station</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium capitalize">
                    <span
                      className={cn("size-2.5 rounded-sm", CAT_BG[w.category])}
                    />
                    {w.category}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {stationById.get(w.stationId)?.shortName}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w.qtyKg.toLocaleString("en-IN")} kg
                </TableCell>
                <TableCell>
                  <Pill variant="muted">{title(w.stage)}</Pill>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <RelativeTime value={w.updatedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
