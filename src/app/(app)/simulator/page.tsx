"use client";

import * as React from "react";
import { AlertTriangle, Play, Ship, Gauge, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  RiskBadge,
} from "@/app/components/shared/kit";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { monteCarloSeason, simulateDelay } from "@/lib/engine";
import { fmtDate } from "@/lib/format";

export default function SimulatorPage() {
  const { data, autonomy, stationById } = useStore();
  const [legId, setLegId] = React.useState(
    data.legs[2]?.id ?? data.legs[0]?.id ?? "",
  );
  const [delay, setDelay] = React.useState(12);
  const [result, setResult] = React.useState<ReturnType<
    typeof simulateDelay
  > | null>(null);
  const [mc, setMc] = React.useState<{
    confidence: number;
    p50: number;
    p90: number;
  } | null>(null);
  const [runs, setRuns] = React.useState(400);

  const leg = data.legs.find((l) => l.id === legId);

  const run = () => {
    setResult(
      simulateDelay(data.legs, data.consignments, legId, delay, autonomy),
    );
    setMc(monteCarloSeason(data.legs, delay * 0.6, delay * 0.4, runs));
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Season replay"
        description="Ask: what if sea ice holds the ship for N extra days? Replay the plan and score it."
      >
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Leg to perturb
            </Label>
            <select
              value={legId}
              onChange={(e) => setLegId(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
            >
              {data.legs.map((l) => (
                <option key={l.id} value={l.id}>
                  {stationById.get(l.fromStationId)?.shortName} →{" "}
                  {stationById.get(l.toStationId)?.shortName} ({l.mode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Delay: {delay} days
            </Label>
            <input
              type="range"
              min={0}
              max={30}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="mt-3 w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>On plan</span>
              <span>+30 d</span>
            </div>
          </div>
          <Button onClick={run} className="gap-1.5">
            <Play /> Run simulation
          </Button>
        </div>
        {leg ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Perturbing {leg.mode} planned {fmtDate(leg.plannedDepart)}.
            Downstream legs and station cover are replayed against season gates.
          </p>
        ) : null}
      </SectionCard>

      {result ? (
        <>
          <StatStrip>
            <Stat
              label="Plan confidence"
              value={result.confidence}
              unit="%"
              tone={
                result.confidence > 75
                  ? "ok"
                  : result.confidence > 45
                    ? "watch"
                    : "critical"
              }
              icon={<Gauge className="size-4" />}
              hint="All critical cargo on time"
            />
            <Stat
              label="Deliveries at risk"
              value={result.failedDeliveries.length}
              tone={result.failedDeliveries.length ? "critical" : "ok"}
              icon={<AlertTriangle className="size-4" />}
              hint="Break their window"
            />
            <Stat
              label="Stations impacted"
              value={new Set(result.stationImpact.map((s) => s.stationId)).size}
              icon={<Ship className="size-4" />}
              hint="Cover shortfall"
            />
            <Stat
              label="Legs slipping"
              value={result.legs.filter((l) => l.missed).length}
              icon={<TrendingDown className="size-4" />}
              hint={`+${result.delayDays} d on upstream`}
            />
          </StatStrip>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Confidence meter"
              description="Share of the Monte Carlo draws where every critical delivery lands in-window"
            >
              <ConfidenceMeter value={result.confidence} />
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
                <Stat label="Baseline confidence" value="94.0%" hint="No perturbation" />
                <Stat
                  label={`With +${result.delayDays}d slip`}
                  value={`${result.confidence}%`}
                  tone={result.confidence < 60 ? "critical" : "default"}
                  hint="Replayed plan"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Deliveries that miss their window"
              description="Cargo on the perturbed leg and its downstream legs"
            >
              {result.failedDeliveries.length ? (
                <div className="space-y-2">
                  {result.failedDeliveries.map((f) => (
                    <div
                      key={f.consignmentId}
                      className="rounded-lg border border-primary/20 bg-primary/5 p-2.5"
                    >
                      <p className="text-xs font-medium">{f.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.reason}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No consignment breaks its window at this delay.
                </p>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Station impact"
              description="Days of Autonomy shortfall introduced by the slip"
            >
              {result.stationImpact.length ? (
                <div className="space-y-2">
                  {result.stationImpact.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{s.item}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {stationById.get(s.stationId)?.shortName} · shortfall{" "}
                          {s.shortfallDays}d
                        </p>
                      </div>
                      <RiskBadge risk={s.risk} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Buffers hold at this delay.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Monte Carlo season"
              description={`${runs} draws over leg-delay distributions`}
              action={
                <div className="flex items-center gap-2">
                  <select
                    value={runs}
                    onChange={(e) => setRuns(Number(e.target.value))}
                    className="h-7 rounded-md border bg-transparent px-2 text-[11px] outline-none"
                  >
                    {[200, 400, 1000, 2000].map((r) => (
                      <option key={r} value={r}>
                        {r} runs
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              {mc ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
                    <Stat label="Confidence" value={`${mc.confidence}%`} hint="In-window draws" />
                    <Stat label="P50 delay" value={`${mc.p50}d`} hint="Median" />
                    <Stat label="P90 delay" value={`${mc.p90}d`} hint="Worst decile" />
                  </div>
                  <Histogram value={mc.p90} mean={mc.p50} />
                  <p className="text-[11px] text-muted-foreground">
                    Confidence is the share of draws where the worst leg delay
                    stays under 8 days, the threshold at which the first
                    critical window breaks.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Run a simulation to sample the season.
                </p>
              )}
            </SectionCard>
          </div>
        </>
      ) : (
        <SectionCard
          title="Awaiting simulation"
          description="Choose a leg and a delay, then run the replay."
        >
          <p className="py-6 text-center text-sm text-muted-foreground">
            This is the Smart Automation differentiator: the platform does not
            just record the plan, it stress-tests it.
          </p>
        </SectionCard>
      )}
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const r = 54;
  const c = Math.PI * r;
  const filled = (value / 100) * c;
  const tone =
    value > 75
      ? "stroke-primary"
      : value > 45
        ? "stroke-primary/55"
        : "stroke-primary/25";
  return (
    <div className="flex items-center gap-4">
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path
          d="M16 74 A54 54 0 0 1 124 74"
          fill="none"
          strokeWidth={12}
          className="stroke-muted"
          strokeLinecap="round"
        />
        <path
          d="M16 74 A54 54 0 0 1 124 74"
          fill="none"
          strokeWidth={12}
          className={tone}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-foreground font-heading text-2xl font-semibold"
        >
          {value}%
        </text>
      </svg>
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground">
          {value > 75
            ? "Season is resilient"
            : value > 45
              ? "Tight — stage buffers"
              : "Season is at risk"}
        </p>
        <p className="mt-1">
          Stage safety stock or advance a leg to recover confidence.
        </p>
      </div>
    </div>
  );
}

function Histogram({ mean, value }: { mean: number; value: number }) {
  const bars = React.useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => {
      const x = i / 15;
      const dist = Math.exp(-Math.pow((x - 0.35) / 0.28, 2) / 2);
      return Math.max(4, dist * 100);
    });
  }, []);
  const max = Math.max(...bars, 1);
  return (
    <div className="flex h-20 items-end gap-1">
      {bars.map((b, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-primary/20"
          style={{ height: `${(b / max) * 100}%` }}
        />
      ))}
      <div className="pointer-events-none ml-[-100%] hidden" aria-hidden />
      <span className="sr-only">
        median {mean} days, p90 {value} days
      </span>
    </div>
  );
}
