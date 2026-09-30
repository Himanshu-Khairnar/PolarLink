"use client";

import * as React from "react";
import { BadgeCheck, Check, HeartPulse, Plus, ShieldAlert, Users } from "lucide-react";
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
import { Label } from "@/app/components/ui/label";
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
  const { data, stationById, updatePersonnel, inScope, can, scope } =
    useStore();
  const allStations = data.stations.filter((s) => s.type === "station");
  const scopedStations =
    scope === "all"
      ? allStations
      : allStations.filter((s) => s.id === scope);
  const stations = scopedStations.length ? scopedStations : allStations;
  const [filter, setFilter] = useTabParam(
    "filter",
    "all",
    (v) =>
      v === "all" ||
      v === "winter" ||
      v === "summer" ||
      stations.some((s) => s.id === v),
  );
  const [selectedId, setSelectedId] = React.useState<ID | null>(null);
  const selected = data.personnel.find((p) => p.id === selectedId) ?? null;

  const scoped = data.personnel.filter((p) => inScope(p.stationId));
  const list = scoped.filter((p) => {
    if (filter === "all") return true;
    if (filter === "winter" || filter === "summer") return p.team === filter;
    return p.stationId === filter;
  });

  const onStation = scoped.filter((p) => p.state === "AT_STATION");

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat
          label="Personnel"
          value={scoped.length}
          unit="on roster"
          icon={<Users className="size-4" />}
          hint={`${scoped.filter((p) => p.team === "winter").length} winter-over`}
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
          value={scoped.filter((p) => p.state === "IN_TRANSIT").length}
          hint="Via Cape Town gateway"
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Medical flags"
          value={scoped.filter((p) => !p.medicalClearance).length}
          tone={scoped.some((p) => !p.medicalClearance) ? "watch" : "ok"}
          hint="Clearance pending"
          icon={<HeartPulse className="size-4" />}
        />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <SectionCard
          title="Roster"
          description="Nomination → medical → training → travel → station → de-induction"
          contentClassName="px-0"
          action={can("personnel.add") ? <AddPersonDialog /> : undefined}
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
                  onClick={() => setSelectedId(p.id)}
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
        open={Boolean(selectedId)}
        onOpenChange={(o) => !o && setSelectedId(null)}
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

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Reassign
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      Station
                    </Label>
                    <select
                      value={selected.stationId ?? ""}
                      disabled={!can("personnel.muster")}
                      onChange={(e) =>
                        updatePersonnel(selected.id, {
                          stationId: e.target.value || undefined,
                        })
                      }
                      className={SELECT_CLS}
                    >
                      <option value="">Unassigned</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      Status
                    </Label>
                    <select
                      value={selected.state}
                      disabled={!can("personnel.muster")}
                      onChange={(e) =>
                        updatePersonnel(selected.id, {
                          state: e.target.value as Personnel["state"],
                        })
                      }
                      className={SELECT_CLS}
                    >
                      {ALL_STATES.map((s) => (
                        <option key={s} value={s}>
                          {title(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Changes apply immediately and queue on the sync lane.
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RollCall() {
  const { data, advanceIncident, raiseIncident, can, scope } = useStore();
  const allStations = data.stations.filter((s) => s.type === "station");
  const scopedStations =
    scope === "all" ? allStations : allStations.filter((s) => s.id === scope);
  const stations = scopedStations.length ? scopedStations : allStations;
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
        disabled={!onStation.length || !can("personnel.muster")}
        title={
          can("personnel.muster")
            ? undefined
            : "Your role cannot close a muster roll-call"
        }
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

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const NEW_STATES: Personnel["state"][] = [
  "NOMINATED",
  "MEDICALLY_CLEARED",
  "TRAINED",
  "REPORTED_GOA",
  "IN_TRANSIT",
  "AT_STATION",
];

const ALL_STATES: Personnel["state"][] = [
  ...NEW_STATES,
  "DE_INDUCTED",
  "EVACUATED",
];

const SELECT_CLS =
  "mt-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring";

function AddPersonDialog() {
  const { data, addPersonnel } = useStore();
  const stations = data.stations.filter((s) => s.type === "station");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [team, setTeam] = React.useState<Personnel["team"]>("summer");
  const [bloodGroup, setBloodGroup] = React.useState("O+");
  const [emergencyContact, setEmergencyContact] = React.useState("");
  const [medicalClearance, setMedicalClearance] = React.useState(false);
  const [training, setTraining] = React.useState("Survival");
  const [state, setState] = React.useState<Personnel["state"]>("NOMINATED");
  const [stationId, setStationId] = React.useState("");

  const valid = name.trim() !== "" && role.trim() !== "";

  const submit = () => {
    if (!valid) return;
    addPersonnel({
      name: name.trim(),
      role: role.trim(),
      team,
      medicalClearance,
      training: training
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      bloodGroup,
      emergencyContact: emergencyContact.trim() || "—",
      stationId: stationId || undefined,
      state,
    });
    setOpen(false);
    setName("");
    setRole("");
    setTeam("summer");
    setBloodGroup("O+");
    setEmergencyContact("");
    setMedicalClearance(false);
    setTraining("Survival");
    setState("NOMINATED");
    setStationId("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus /> Add person
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add personnel</DialogTitle>
          <DialogDescription>
            Nominates a person onto the roster. Clearance and training follow
            the standard induction flow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Arjun Sharma"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Role
              </Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Glaciologist"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Team
              </Label>
              <select
                value={team}
                onChange={(e) =>
                  setTeam(e.target.value as Personnel["team"])
                }
                className={SELECT_CLS}
              >
                <option value="summer">Summer</option>
                <option value="winter">Winter-over</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Blood group
              </Label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className={SELECT_CLS}
              >
                {BLOOD_GROUPS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Emergency contact
            </Label>
            <Input
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="+91 98XXXXXXXX"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Training (comma separated)
            </Label>
            <Input
              value={training}
              onChange={(e) => setTraining(e.target.value)}
              placeholder="Survival, First aid"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Status
              </Label>
              <select
                value={state}
                onChange={(e) =>
                  setState(e.target.value as Personnel["state"])
                }
                className={SELECT_CLS}
              >
                {NEW_STATES.map((s) => (
                  <option key={s} value={s}>
                    {title(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Medical clearance
              </Label>
              <select
                value={medicalClearance ? "yes" : "no"}
                onChange={(e) => setMedicalClearance(e.target.value === "yes")}
                className={SELECT_CLS}
              >
                <option value="no">Pending</option>
                <option value="yes">Cleared</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Station (optional)
            </Label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Unassigned</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </div>
          <Button className="w-full" disabled={!valid} onClick={submit}>
            Add person
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
