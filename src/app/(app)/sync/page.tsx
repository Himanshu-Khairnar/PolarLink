"use client";

import * as React from "react";
import { ArrowDownToLine, ArrowUpFromLine, Cloud, Radio, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useStore, type LinkMode } from "@/lib/store";
import { SectionCard, StatStrip, Stat, Pill, Bar } from "@/components/shared/kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RelativeTime } from "@/components/shared/relative-time";
import { compactBytes } from "@/lib/format";
import { cn } from "cn";
import type { SyncPriority } from "@/lib/types";

const PRIORITY_TONE: Record<SyncPriority, string> = {
  P0: "border-red-500/30 bg-red-500/10 text-red-500",
  P1: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  P2: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const LINK_META: Record<LinkMode, { label: string; detail: string; icon: typeof Wifi }> = {
  online: { label: "VSAT / 4G", detail: "Bulk lanes drain continuously", icon: Wifi },
  throttled: { label: "Satellite · 2.4 kbps", detail: "P0 first, compact packets only", icon: Radio },
  offline: { label: "Offline buffering", detail: "Node queues to the local event log", icon: WifiOff },
};

export default function SyncPage() {
  const { data, link, setLink, drainSync } = useStore();
  const [budget, setBudget] = React.useState(4096);
  const [outbound, setOutbound] = React.useState(true);

  const pending = data.syncLog.filter((s) => !s.appliedAt);
  const applied = data.syncLog.filter((s) => s.appliedAt);
  const rows = outbound ? pending : applied;
  const pendingBytes = pending.reduce((a, b) => a + b.bytes, 0);

  const lane = (p: SyncPriority) => {
    const events = pending.filter((e) => e.priority === p);
    return { count: events.length, bytes: events.reduce((a, b) => a + b.bytes, 0) };
  };

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat label="Pending events" value={pending.length} unit={`${compactBytes(pendingBytes)}`} tone={pending.length ? "watch" : "ok"} icon={<ArrowUpFromLine className="size-4" />} hint="Queued in priority lanes" />
        <Stat label="Applied" value={applied.length} tone="ok" icon={<ArrowDownToLine className="size-4" />} hint="Reconciled at HQ" />
        <Stat label="Lamport clock" value={Math.max(...data.syncLog.map((s) => s.lamportTs), 0)} icon={<RefreshCw className="size-4" />} hint="Last-writer-wins ordering" />
        <Stat label="Edge nodes" value={4} unit="active" icon={<Cloud className="size-4" />} hint="Maitri · Bharati · ship · Himadri" />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <SectionCard title="Link mode" description="Simulate the station link quality">
            <div className="space-y-2">
              {(Object.keys(LINK_META) as LinkMode[]).map((m) => {
                const meta = LINK_META[m];
                const Icon = meta.icon;
                return (
                  <button
                    key={m}
                    onClick={() => setLink(m)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      link === m ? "border-foreground/30 bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <Icon className={cn("size-4", m === "offline" ? "text-red-500" : m === "throttled" ? "text-amber-500" : "text-emerald-500")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground">{meta.detail}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Byte budget" description="Bytes allowed per sync window">
            <p className="font-heading text-2xl font-semibold">{compactBytes(budget)}</p>
            <input
              type="range"
              min={256}
              max={65536}
              step={256}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-3 w-full accent-foreground"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>256 B</span>
              <span>64 KB</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => drainSync(budget)}
                disabled={!pending.length}
              >
                <RefreshCw /> Flush lanes
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              P0 always goes first; P2 photos wait for a wider window. Events are idempotent by UUID, so re-sends are safe.
            </p>
          </SectionCard>

          <SectionCard title="Merge rules" description="How two offline nodes reconcile">
            <ul className="space-y-2 text-[11px] text-muted-foreground">
              <li><span className="font-medium text-foreground">Inventory deltas</span> are summed — commutative counters.</li>
              <li><span className="font-medium text-foreground">Custody events</span> append, hash-verified.</li>
              <li><span className="font-medium text-foreground">Entity fields</span> resolve last-writer-wins by Lamport timestamp then node id.</li>
              <li><span className="font-medium text-foreground">Semantic conflicts</span> (one asset at two stations) go to a review queue.</li>
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(["P0", "P1", "P2"] as SyncPriority[]).map((p) => {
              const l = lane(p);
              return (
                <SectionCard
                  key={p}
                  title={
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", PRIORITY_TONE[p])}>{p}</span>
                      {p === "P0" ? "SOS / medical" : p === "P1" ? "Inventory / custody" : "Bulk / photos"}
                    </span>
                  }
                >
                  <p className="font-heading text-xl font-semibold">{l.count} <span className="text-xs font-normal text-muted-foreground">queued</span></p>
                  <p className="text-[11px] text-muted-foreground">{compactBytes(l.bytes)}</p>
                  <Bar value={l.bytes} max={Math.max(pendingBytes, 1)} className="mt-2" />
                </SectionCard>
              );
            })}
          </div>

          <SectionCard
            title="Event log"
            description="Append-only local writes, pushed then pulled by Lamport timestamp"
            action={
              <button
                onClick={() => setOutbound((v) => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className={cn(outbound ? "text-foreground" : "text-muted-foreground")}>Queued</span>
                <span className="relative inline-flex h-4 w-8 items-center rounded-full bg-muted">
                  <span className={cn("size-3 rounded-full bg-foreground transition-transform", outbound ? "translate-x-4" : "translate-x-0.5")} />
                </span>
                <span className={cn(!outbound ? "text-foreground" : "text-muted-foreground")}>Applied</span>
              </button>
            }
            contentClassName="px-0"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UUID</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Op</TableHead>
                  <TableHead>Lane</TableHead>
                  <TableHead className="text-right">Bytes</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[11px]">{s.eventUuid}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.originNode}</TableCell>
                    <TableCell className="text-xs">{s.entity}</TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">{s.op}</TableCell>
                    <TableCell>
                      <Pill className={PRIORITY_TONE[s.priority]}>{s.priority}</Pill>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{s.bytes}</TableCell>
                    <TableCell>
                      {s.appliedAt ? (
                        <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                          applied <RelativeTime value={s.appliedAt} />
                        </Pill>
                      ) : (
                        <Pill className="border-amber-500/30 bg-amber-500/10 text-amber-500">queued</Pill>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
