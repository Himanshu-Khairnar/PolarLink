"use client";

import * as React from "react";
import { Leaf, Recycle, Ship, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatCard, Pill, Bar } from "@/components/shared/kit";
import { StageFlow } from "@/components/shared/stage-flow";
import { Donut, HBars } from "@/components/shared/charts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RelativeTime } from "@/components/shared/relative-time";
import { title } from "@/lib/format";
import { cn } from "cn";
import type { WasteEntry } from "@/lib/types";

const STAGES: WasteEntry["stage"][] = ["generated", "segregated", "packed", "loaded", "returned"];

const CAT_TEXT: Record<WasteEntry["category"], string> = {
  metal: "text-slate-400",
  plastic: "text-sky-500",
  hazardous: "text-red-500",
  biological: "text-amber-500",
  paper: "text-emerald-500",
  glass: "text-violet-500",
};

const CAT_COLOR: Record<WasteEntry["category"], string> = {
  metal: "bg-slate-400",
  plastic: "bg-sky-500",
  hazardous: "bg-red-500",
  biological: "bg-amber-500",
  paper: "bg-emerald-500",
  glass: "bg-violet-500",
};

export default function WastePage() {
  const { data, setWasteStage, stationById } = useStore();
  const total = data.waste.reduce((a, b) => a + b.qtyKg, 0);
  const returned = data.waste.filter((w) => w.stage === "returned").reduce((a, b) => a + b.qtyKg, 0);
  const hazardous = data.waste.filter((w) => w.category === "hazardous").reduce((a, b) => a + b.qtyKg, 0);
  const compliance = total ? Math.round((returned / total) * 100) : 0;

  const byCategory = (Object.keys(CAT_COLOR) as WasteEntry["category"][]).map((c) => ({
    category: c,
    qty: data.waste.filter((w) => w.category === c).reduce((a, b) => a + b.qtyKg, 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waste generated" value={Math.round(total / 1000)} unit="t" icon={<Trash2 className="size-4" />} hint="Reverse cargo tracked" />
        <StatCard label="Returned" value={Math.round(returned / 1000)} unit="t" tone="ok" icon={<Ship className="size-4" />} hint="Removed from the continent" />
        <StatCard label="Hazardous" value={hazardous} unit="kg" tone={hazardous ? "watch" : "ok"} icon={<Leaf className="size-4" />} hint="Class 8 batteries, oils" />
        <StatCard label="Compliance" value={compliance} unit="%" tone={compliance > 70 ? "ok" : "watch"} icon={<Recycle className="size-4" />} hint="Madrid Protocol Annex III" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="By category" description="Season-to-date, all stations">
          <Donut
            segments={byCategory.map((c) => ({
              value: Math.round(c.qty),
              className: CAT_TEXT[c.category],
              swatchClassName: CAT_COLOR[c.category],
              label: title(c.category),
            }))}
            centerLabel={`${Math.round(total / 1000)}t`}
            centerSub="total"
          />
          <div className="mt-4">
            <HBars rows={byCategory.map((c) => ({ label: title(c.category), value: c.qty, className: CAT_COLOR[c.category] }))} unit="kg" />
          </div>
        </SectionCard>

        <SectionCard className="lg:col-span-2" title="Reverse-cargo pipeline" description="Generated → segregated → packed → loaded → returned">
          <div className="space-y-3">
            {data.waste.map((w) => {
              const idx = STAGES.indexOf(w.stage);
              const station = stationById.get(w.stationId);
              return (
                <div key={w.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-sm", CAT_COLOR[w.category])} />
                      <span className="text-xs font-medium capitalize">{w.category}</span>
                      <Pill variant="muted">{station?.shortName}</Pill>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{w.qtyKg.toLocaleString("en-IN")} kg</span>
                  </div>
                  <StageFlow steps={STAGES} activeIndex={idx} separator="glyph" className="mt-2.5" />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Updated <RelativeTime value={w.updatedAt} />
                    </span>
                    {idx < STAGES.length - 1 ? (
                      <Button variant="outline" size="xs" onClick={() => setWasteStage(w.id, STAGES[idx + 1])}>
                        Advance → {title(STAGES[idx + 1])}
                      </Button>
                    ) : (
                      <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">removed</Pill>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Seasonal compliance summary" description="Auto-generated for the Ministry / CAG audit pack">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s) => {
            const qty = data.waste.filter((w) => w.stage === s).reduce((a, b) => a + b.qtyKg, 0);
            return (
              <div key={s} className="rounded-lg border p-3">
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{title(s)}</p>
                <p className="mt-1 font-heading text-lg font-semibold">{qty.toLocaleString("en-IN")} kg</p>
                <Bar value={qty} max={total} className="mt-2" />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Waste is treated as reverse cargo with its own custody chain, so the removal obligation under Annex III is provable end to end.
        </p>
      </SectionCard>

      <SectionCard title="Ledger entries" description="Every movement is appended to the shared event log" contentClassName="px-0">
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
            {data.waste.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="capitalize font-medium">{w.category}</TableCell>
                <TableCell className="text-muted-foreground">{stationById.get(w.stationId)?.shortName}</TableCell>
                <TableCell className="text-right tabular-nums">{w.qtyKg.toLocaleString("en-IN")} kg</TableCell>
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
