"use client";

import * as React from "react";
import { BadgeCheck, HeartPulse, ShieldAlert, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { SectionCard, StatCard, Pill } from "@/components/shared/kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { title } from "@/lib/format";
import { cn } from "cn";
import type { ID, Personnel } from "@/lib/types";

const STATE_TONE: Record<Personnel["state"], string> = {
  NOMINATED: "bg-muted text-muted-foreground border-border",
  MEDICALLY_CLEARED: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  TRAINED: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  REPORTED_GOA: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  IN_TRANSIT: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  AT_STATION: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  DE_INDUCTED: "bg-muted text-muted-foreground border-border",
  EVACUATED: "bg-red-500/15 text-red-500 border-red-500/30",
};

export default function PersonnelPage() {
  const { data } = useStore();
  const stations = data.stations.filter((s) => s.type === "station");
  const [filter, setFilter] = React.useState<"all" | "winter" | "summer" | ID>("all");
  const [selected, setSelected] = React.useState<Personnel | null>(null);

  const list = data.personnel.filter((p) => {
    if (filter === "all") return true;
    if (filter === "winter" || filter === "summer") return p.team === filter;
    return p.stationId === filter;
  });

  const onStation = data.personnel.filter((p) => p.state === "AT_STATION");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Personnel" value={data.personnel.length} unit="on roster" icon={<Users className="size-4" />} hint={`${data.personnel.filter((p) => p.team === "winter").length} winter-over`} />
        <StatCard label="On station" value={onStation.length} icon={<BadgeCheck className="size-4" />} tone="ok" hint={`${onStation.filter((p) => p.stationId === "st-bharati").length} at Bharati`} />
        <StatCard label="In transit" value={data.personnel.filter((p) => p.state === "IN_TRANSIT").length} hint="Via Cape Town gateway" icon={<Users className="size-4" />} />
        <StatCard
          label="Medical flags"
          value={data.personnel.filter((p) => !p.medicalClearance).length}
          tone={data.personnel.some((p) => !p.medicalClearance) ? "watch" : "ok"}
          hint="Clearance pending"
          icon={<HeartPulse className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SectionCard title="Roster" description="Nomination → medical → training → travel → station → de-induction" contentClassName="px-0">
          <div className="px-4 pb-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="summer">Summer</TabsTrigger>
                <TabsTrigger value="winter">Winter-over</TabsTrigger>
                {stations.map((s) => (
                  <TabsTrigger key={s.id} value={s.id}>
                    {s.shortName}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Medical</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                  <TableCell className="font-medium">
                    {p.name}
                    <span className="ml-2 text-[10px] text-muted-foreground">{p.bloodGroup}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.role}</TableCell>
                  <TableCell>
                    <Pill className={cn(p.team === "winter" ? "border-sky-500/30 bg-sky-500/10 text-sky-400" : "border-amber-500/30 bg-amber-500/10 text-amber-500")}>
                      {p.team}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <Pill className={STATE_TONE[p.state]}>{title(p.state)}</Pill>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {data.stations.find((s) => s.id === p.stationId)?.shortName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {p.medicalClearance ? (
                      <BadgeCheck className="size-4 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="size-4 text-amber-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <RollCall />
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.role} · {selected?.team} team
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <Row label="State" value={title(selected.state)} />
              <Row label="Location" value={data.stations.find((s) => s.id === selected.stationId)?.name ?? "Not yet deployed"} />
              <Row label="Medical clearance" value={selected.medicalClearance ? "Cleared" : "Pending"} />
              <Row label="Blood group" value={selected.bloodGroup} />
              <Row label="Emergency contact" value={selected.emergencyContact} />
              <div>
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Training</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selected.training.map((t) => (
                    <Pill key={t} variant="muted">{t}</Pill>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RollCall() {
  const { data, advanceIncident, raiseIncident } = useStore();
  const stations = data.stations.filter((s) => s.type === "station");
  const [stationId, setStationId] = React.useState<ID>(stations[0].id);
  const [present, setPresent] = React.useState<Set<ID>>(new Set());
  const [search, setSearch] = React.useState("");

  const onStation = data.personnel.filter((p) => p.state === "AT_STATION" && p.stationId === stationId);
  const shown = onStation.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const unaccounted = onStation.filter((p) => !present.has(p.id));

  return (
    <SectionCard
      title="Muster roll-call"
      description="Account for every soul on station during an emergency"
      action={
        <Button
          variant="outline"
          size="xs"
          onClick={() => setPresent(new Set(onStation.map((p) => p.id)))}
        >
          All present
        </Button>
      }
    >
      <select
        value={stationId}
        onChange={(e) => {
          setStationId(e.target.value);
          setPresent(new Set());
        }}
        className="mb-3 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
      >
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name…" className="mb-3 h-8 text-xs" />

      <div className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
        <span className="text-muted-foreground">Accounted</span>
        <span className={cn("font-semibold tabular-nums", unaccounted.length ? "text-amber-500" : "text-emerald-500")}>
          {present.size} / {onStation.length}
        </span>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {shown.map((p) => {
          const isPresent = present.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() =>
                setPresent((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                })
              }
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                isPresent ? "border-emerald-500/30 bg-emerald-500/10" : "hover:bg-muted/50"
              )}
            >
              <span className={cn("size-3.5 rounded-full border", isPresent ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground")} />
              <span className="font-medium">{p.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{p.role}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            if (unaccounted.length) {
              const inc = raiseIncident({
                type: "missing_person",
                severity: unaccounted.length > 1 ? "high" : "medium",
                stationId,
                personId: unaccounted[0].id,
                summary: `Muster incomplete: ${unaccounted.map((p) => p.name).join(", ")} unaccounted after roll-call.`,
              });
              advanceIncident(inc.id, "MUSTER_COMPLETE", "Roll-call completed, search initiated.");
            } else {
              const inc = data.incidents.find((i) => i.type === "medical");
              if (inc) advanceIncident(inc.id, "MUSTER_COMPLETE", "All personnel accounted for at station.");
            }
          }}
        >
          Complete roll-call
        </Button>
      </div>
      {unaccounted.length ? (
        <p className="mt-2 text-[11px] text-amber-500">
          {unaccounted.length} unaccounted — completing will raise a missing-person incident.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-emerald-500">Everyone accounted for. Muster can be closed.</p>
      )}
    </SectionCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  );
}
