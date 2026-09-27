"use client";

import * as React from "react";
import { Boxes, CalendarClock, FlaskConical, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { consumptionSeries } from "@/lib/data/seed";
import { SectionCard, StatCard, Pill, RiskBadge, Bar } from "@/components/shared/kit";
import { Field } from "@/components/shared/field";
import { ForecastChart } from "@/components/shared/charts";
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
import { fmtNum } from "@/lib/format";
import { cn } from "cn";
import type { AutonomyRow, ID } from "@/lib/types";

export default function InventoryPage() {
  const { data, autonomy, nextResupplyDays, addInventoryTxn, stationById } = useStore();
  const stations = data.stations.filter((s) => s.type === "station");
  const [stationId, setStationId] = React.useState<ID>(stations[0]?.id ?? "");
  const [selected, setSelected] = React.useState<AutonomyRow | null>(null);

  const station = stationById.get(stationId);
  const rows = autonomy[stationId] ?? [];
  const resupply = nextResupplyDays(stationId);

  const critical = rows.filter((r) => r.risk === "CRITICAL");
  const watch = rows.filter((r) => r.risk === "WATCH");
  const minRow = rows[0];

  return (
    <div className="space-y-4">
      <Tabs value={stationId} onValueChange={(v) => setStationId(v as string)}>
        <TabsList>
          {stations.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.shortName}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Lowest autonomy"
          value={minRow ? minRow.daysLeft : "—"}
          unit="days"
          tone={minRow?.risk === "CRITICAL" ? "critical" : minRow?.risk === "WATCH" ? "watch" : "ok"}
          hint={minRow ? minRow.name : "No data"}
          icon={<TrendingDown className="size-4" />}
        />
        <StatCard label="Critical lines" value={critical.length} unit="items" tone={critical.length ? "critical" : "ok"} hint={critical.map((c) => c.name).slice(0, 2).join(", ") || "None"} icon={<Boxes className="size-4" />} />
        <StatCard label="Watch lines" value={watch.length} unit="items" tone={watch.length ? "watch" : "ok"} hint="Within 25% of resupply gap" icon={<FlaskConical className="size-4" />} />
        <StatCard label="Next resupply" value={resupply} unit="days" hint={station?.shortName} icon={<CalendarClock className="size-4" />} />
      </div>

      <SectionCard
        title={`${station?.shortName} · stock cover`}
        description="Days of autonomy = current stock ÷ forecast daily use, compared with the next feasible resupply"
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Use / day</TableHead>
              <TableHead className="min-w-52">Cover vs. resupply</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pct = Math.min(100, (r.daysLeft / Math.max(r.nextResupplyDays, 1)) * 100);
              return (
                <TableRow key={r.itemId}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      {r.name}
                      {r.critical ? <Pill className="border-red-500/30 bg-red-500/10 text-red-500">critical</Pill> : null}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{r.category}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNum(r.stock, r.stock < 100 ? 1 : 0)} {r.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(r.dailyUse, 2)}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <RiskBadge risk={r.risk} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="xs" onClick={() => setSelected(r)}>
                      Forecast
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <ItemDialog
        row={selected}
        stationId={stationId}
        onClose={() => setSelected(null)}
        addTxn={addInventoryTxn}
        forecast={useForecast(selected, stationId)}
      />
    </div>
  );
}

function useForecast(row: AutonomyRow | null, stationId: ID) {
  const { forecast } = useStore();
  return React.useMemo(
    () =>
      row
        ? {
            history: consumptionSeries(stationId, row.itemId, 90),
            future: forecast(stationId, row.itemId, 90),
          }
        : { history: [], future: [] },
    [row, stationId, forecast]
  );
}

function ItemDialog({
  row,
  stationId,
  onClose,
  addTxn,
  forecast,
}: {
  row: AutonomyRow | null;
  stationId: ID;
  onClose: () => void;
  addTxn: ReturnType<typeof useStore>["addInventoryTxn"];
  forecast: { history: number[]; future: { day: number; value: number }[] };
}) {
  const [qty, setQty] = React.useState("10");
  const [reason, setReason] = React.useState<"consumed" | "received" | "wastage" | "count_adj">("consumed");

  if (!row) return null;
  const amount = Number(qty) || 0;
  const delta = reason === "received" ? amount : reason === "count_adj" ? amount : -Math.abs(amount);
  const projected = row.dailyUse > 0 ? Math.floor((row.stock + delta) / row.dailyUse) : 0;

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {row.name} <RiskBadge risk={row.risk} />
          </DialogTitle>
          <DialogDescription>
            {forecast.history.length} days of history with a 90-day Holt-Winters forecast
          </DialogDescription>
        </DialogHeader>

        <div className="text-foreground">
          <ForecastChart history={forecast.history} forecast={forecast.future} threshold={row.dailyUse * 30} />
          <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-foreground" /> Actual</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 border-t border-dashed border-foreground/60" /> Forecast</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-red-500/60" /> 30-day safety line</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Field className="px-2 py-2" labelClassName="text-[10px]" valueClassName="text-sm" label="Current cover" value={`${row.daysLeft} d`} />
          <Field className="px-2 py-2" labelClassName="text-[10px]" valueClassName="text-sm" label="Daily use" value={`${fmtNum(row.dailyUse, 2)} ${row.unit}`} />
          <Field className="px-2 py-2" labelClassName="text-[10px]" valueClassName="text-sm" label="Resupply gap" value={`${row.nextResupplyDays} d`} />
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Log a stock transaction</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <Label className="text-[10px] text-muted-foreground uppercase">Qty ({row.unit})</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} type="number" className="mt-1 h-8 text-xs" />
            </div>
            <div className="w-40">
              <Label className="text-[10px] text-muted-foreground uppercase">Reason</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className="mt-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
              >
                <option value="consumed">Consumed</option>
                <option value="received">Received</option>
                <option value="wastage">Wastage</option>
                <option value="count_adj">Count adjustment</option>
              </select>
            </div>
            <Button
              size="sm"
              onClick={() => {
                addTxn({ stationId, itemId: row.itemId, delta, reason, actor: "Store keeper" });
                onClose();
              }}
            >
              Apply {delta > 0 ? "+" : ""}
              {delta}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            New projected cover ≈ <span className={cn("font-medium", projected < row.nextResupplyDays ? "text-red-500" : "text-emerald-500")}>{projected} days</span>. Deltas merge commutatively during offline sync.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
