"use client";

import * as React from "react";
import { BadgeCheck, Check, HeartPulse, ShieldAlert, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  Pill,
} from "@/app/components/shared/kit";
import { StationSelect } from "@/app/components/shared/station-select";
import { Field } from "@/app/components/shared/field";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useTabParam } from "@/lib/use-tab-param";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { title } from "@/lib/format";
import { cn } from "cn";
import type { ID, Personnel } from "@/lib/types";

const STATE_TONE: Record<Personnel["state"], string> = {
  NOMINATED: "bg-muted text-muted-foreground border-border",
  MEDICALLY_CLEARED: "bg-muted text-muted-foreground border-border",
  TRAINED: "bg-primary/5 text-foreground/70 border-primary/15",
  REPORTED_GOA: "bg-primary/10 text-foreground/80 border-primary/20",
  IN_TRANSIT: "bg-primary/15 text-foreground border-primary/25",
  AT_STATION: "bg-primary text-primary-foreground border-primary",
  DE_INDUCTED: "bg-muted text-muted-foreground border-border",
  EVACUATED: "bg-transparent text-foreground border-primary",
};

export default function PersonnelPage() {
  const { data, stationById } = useStore();
  const stations = data.stations.filter((s) => s.type === "station");
  const [filter, setFilter] = useTabParam(
    "filter",
    "all",
    (v) =>
      v === "all" ||
      v === "winter" ||
      v === "summer" ||
      stations.some((s) => s.id === v),
  );
  const [selected, setSelected] = React.useState<Personnel | null>(null);

  const list = data.personnel.filter((p) => {
    if (filter === "all") return true;
    if (filter === "winter" || filter === "summer") return p.team === filter;
    return p.stationId === filter;
  });

  const onStation = data.personnel.filter((p) => p.state === "AT_STATION");

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat
          label="Personnel"
          value={data.personnel.length}
          unit="on roster"
          icon={<Users className="size-4" />}
          hint={`${data.personnel.filter((p) => p.team === "winter").length} winter-over`}
        />
        <Stat
          label="On station"
          value={onStation.length}
          icon={<BadgeCheck className="size-4" />}
          tone="ok"
          hint={`${onStation.filter((p) => p.stationId === "st-bharati").length} at Bharati`}
        />
        <Stat
          label="In transit"
          value={data.personnel.filter((p) => p.state === "IN_TRANSIT").length}
          hint="Via Cape Town gateway"
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Medical flags"
          value={data.personnel.filter((p) => !p.medicalClearance).length}
          tone={
            data.personnel.some((p) => !p.medicalClearance) ? "watch" : "ok"
          }
          hint="Clearance pending"
          icon={<HeartPulse className="size-4" />}
        />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SectionCard
          title="Roster"
          description="Nomination → medical → training → travel → station → de-induction"
          contentClassName="px-0"
        >
          <div className="px-4 pb-3">
            <Tabs value={filter} onValueChange={setFilter}>
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
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(p)}
                >
                  <TableCell className="font-medium">
                    {p.name}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {p.bloodGroup}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.role}
                  </TableCell>
                  <TableCell>
                    <Pill
                      className={cn(
                        p.team === "winter"
                          ? "border-primary/20 bg-primary/10 text-foreground"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {p.team}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <Pill className={STATE_TONE[p.state]}>
                      {title(p.state)}
                    </Pill>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {stationById.get(p.stationId ?? "")?.shortName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {p.medicalClearance ? (
                      <BadgeCheck className="size-4 text-muted-foreground" />
                    ) : (
                      <ShieldAlert className="size-4 text-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <RollCall />
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.role} · {selected?.team} team
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <Field
                variant="row"
                label="State"
                value={title(selected.state)}
              />
              <Field
                variant="row"
                label="Location"
                value={
                  stationById.get(selected.stationId ?? "")?.name ??
                  "Not yet deployed"
                }
              />
              <Field
                variant="row"
                label="Medical clearance"
                value={selected.medicalClearance ? "Cleared" : "Pending"}
              />
              <Field
                variant="row"
                label="Blood group"
                value={selected.bloodGroup}
              />
              <Field
                variant="row"
                label="Emergency contact"
                value={selected.emergencyContact}
              />
              <div>
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                  Training
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selected.training.map((t) => (
                    <Pill key={t} variant="muted">
                      {t}
                    </Pill>
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
  const [stationId, setStationId] = React.useState<ID>(stations[0]?.id ?? "");
  const [present, setPresent] = React.useState<Set<ID>>(new Set());
  const [search, setSearch] = React.useState("");

  const onStation = data.personnel.filter(
    (p) => p.state === "AT_STATION" && p.stationId === stationId,
  );
  const shown = onStation.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const unaccounted = onStation.filter((p) => !present.has(p.id));
  const done = onStation.length > 0 && present.size >= onStation.length;
  const pct = onStation.length
    ? Math.round((present.size / onStation.length) * 100)
    : 0;

  return (
    <SectionCard
      title="Muster roll-call"
      description="Account for every soul on station during an emergency"
      className="self-start"
      action={
        <Button
          variant="outline"
          size="xs"
          disabled={!onStation.length}
          onClick={() => setPresent(new Set(onStation.map((p) => p.id)))}
        >
          All present
        </Button>
      }
    >
      <StationSelect
        stations={stations}
        value={stationId}
        onChange={(v) => {
          setStationId(v);
          setPresent(new Set());
        }}
        label="name"
        className="w-full"
      />

      <div className="mt-2 rounded-lg border bg-card px-2.5 py-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium tabular-nums">
            {present.size}
            <span className="text-muted-foreground">/{onStation.length}</span>{" "}
            accounted
          </span>
          <span
            className={cn(
              "shrink-0 font-medium tabular-nums",
              unaccounted.length ? "text-primary" : "text-muted-foreground",
            )}
          >
            {unaccounted.length} missing
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              done ? "bg-chart-2" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by name…"
        className="mt-2 h-7 text-xs"
      />

      <div className="mt-2 max-h-56 divide-y overflow-y-auto rounded-lg border">
        {shown.length ? (
          shown.map((p) => {
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
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
                  isPresent ? "bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.name}
                </span>
                <span className="max-w-[38%] shrink-0 truncate text-[10px] text-muted-foreground">
                  {p.role}
                </span>
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                    isPresent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/50",
                  )}
                >
                  {isPresent ? <Check className="size-2.5" /> : null}
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            No personnel on station.
          </p>
        )}
      </div>

      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={!onStation.length}
        onClick={() => {
          if (unaccounted.length) {
            const inc = raiseIncident({
              type: "missing_person",
              severity: unaccounted.length > 1 ? "high" : "medium",
              stationId,
              personId: unaccounted[0].id,
              summary: `Muster incomplete: ${unaccounted.map((p) => p.name).join(", ")} unaccounted after roll-call.`,
            });
            advanceIncident(
              inc.id,
              "MUSTER_COMPLETE",
              "Roll-call completed, search initiated.",
            );
          } else {
            const inc = data.incidents.find((i) => i.type === "medical");
            if (inc)
              advanceIncident(
                inc.id,
                "MUSTER_COMPLETE",
                "All personnel accounted for at station.",
              );
          }
        }}
      >
        Complete roll-call
      </Button>
      {unaccounted.length ? (
        <p className="mt-2 text-[11px] text-primary/80">
          {unaccounted.length} unaccounted — completing will raise a
          missing-person incident.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Everyone accounted for. Muster can be closed.
        </p>
      )}
    </SectionCard>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
