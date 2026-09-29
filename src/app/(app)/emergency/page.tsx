"use client";

import * as React from "react";
import {
  Activity,
  CloudLightning,
  MapPin,
  Radio,
  Route as RouteIcon,
  Siren,
  Stethoscope,
  Waves,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  SectionCard,
  StatStrip,
  Stat,
  Pill,
} from "@/app/components/shared/kit";
import { StageFlow } from "@/app/components/shared/stage-flow";
import { StationSelect } from "@/app/components/shared/station-select";
import { NetworkMap } from "@/app/components/shared/network-map";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { buildEvacEdges, rankEvacRoutes } from "@/lib/engine";
import { fmtDateTime, title } from "@/lib/format";
import { cn } from "cn";
import type { ID, Incident } from "@/lib/types";

const INCIDENT_FLOW: Incident["status"][] = [
  "RAISED",
  "ACKNOWLEDGED",
  "MUSTER_COMPLETE",
  "RESPONSE_ACTIVE",
  "EVACUATING",
  "RESOLVED",
  "REVIEWED",
];

const SEV_TONE: Record<string, string> = {
  critical: "border-foreground bg-foreground text-background",
  high: "border-foreground/40 bg-foreground/10 text-foreground",
  medium: "border-foreground/25 bg-foreground/5 text-foreground/75",
  low: "border-border bg-muted text-muted-foreground",
};

export default function EmergencyPage() {
  const { data, stationById, raiseIncident, advanceIncident } = useStore();
  const stations = data.stations;
  const [origin, setOrigin] = React.useState<ID>("st-maitri");

  const edges = React.useMemo(
    () => buildEvacEdges(stations, data.legs),
    [stations, data.legs],
  );
  const routes = React.useMemo(
    () => rankEvacRoutes(origin, stations, edges),
    [origin, stations, edges],
  );
  const [activeRoute, setActiveRoute] = React.useState<string | null>(null);

  const openIncidents = data.incidents.filter(
    (i) => i.status !== "RESOLVED" && i.status !== "REVIEWED",
  );
  const medicalIncidents = data.incidents.filter((i) => i.type === "medical");

  return (
    <div className="space-y-4">
      <StatStrip>
        <Stat
          label="Open incidents"
          value={openIncidents.length}
          tone={
            openIncidents.some((i) => i.severity === "critical")
              ? "critical"
              : "watch"
          }
          icon={<Siren className="size-4" />}
          hint="Live on HQ dashboard"
        />
        <Stat
          label="Medical"
          value={medicalIncidents.length}
          icon={<Stethoscope className="size-4" />}
          hint="Medicine stock matched to need"
        />
        <Stat
          label="Feasible routes"
          value={routes.filter((r) => r.feasible).length}
          unit="from origin"
          icon={<RouteIcon className="size-4" />}
          hint={stationById.get(origin)?.shortName}
        />
        <Stat
          label="SOS packet"
          value="19"
          unit="bytes"
          icon={<Radio className="size-4" />}
          hint="Fits one Iridium SBD message"
          tone="ok"
        />
      </StatStrip>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard
            title="Incident command"
            description="SOS → acknowledged → muster → response → evacuation → resolution"
            action={<SosButton onRaise={raiseIncident} />}
          >
            <div className="space-y-3">
              {data.incidents.map((inc) => (
                <IncidentRow
                  key={inc.id}
                  incident={inc}
                  onAdvance={advanceIncident}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="International evacuation engine"
            description="Graph of stations, partner stations and assets with season + weather gates"
            action={
              <StationSelect
                stations={stations.filter((s) => s.type === "station")}
                value={origin}
                onChange={(v) => {
                  setOrigin(v);
                  setActiveRoute(null);
                }}
                prefix="From "
              />
            }
          >
            <NetworkMap
              stations={stations}
              legs={data.legs}
              highlightStationId={origin}
              routeHops={
                activeRoute
                  ? routes.find((r) => r.id === activeRoute)?.hops
                  : undefined
              }
              className="mb-3"
            />
            <div className="space-y-2">
              {routes.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRoute(r.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    activeRoute === r.id
                      ? "border-foreground/40 bg-foreground/5"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.totalHours}h total · {r.transfers} transfer
                      {r.transfers === 1 ? "" : "s"} ·{" "}
                      {Math.round(r.weatherOkProb * 100)}% weather-ok · medical
                      gap {r.medicalGap}
                    </p>
                  </div>
                  <Pill
                    className={cn(
                      "border-transparent",
                      r.feasible
                        ? "bg-muted text-muted-foreground"
                        : "bg-foreground/10 text-foreground",
                    )}
                  >
                    {r.feasible ? "feasible" : "gated"}
                  </Pill>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
                    {r.score}
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SosPanel origin={origin} onRaise={raiseIncident} />
          <CompactPacketDemo />
          <SectionCard
            title="Weather gates"
            description="Open-Meteo style probability per route edge"
          >
            <div className="space-y-2">
              {edges
                .filter((e) => e.from === origin || e.to === origin)
                .slice(0, 6)
                .map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {e.weatherOkProb > 0.7 ? (
                      <CloudLightning className="size-3.5 text-foreground/60" />
                    ) : (
                      <Waves className="size-3.5 text-muted-foreground/60" />
                    )}
                    <span className="text-muted-foreground">
                      {stationById.get(e.from)?.shortName} →{" "}
                      {stationById.get(e.to)?.shortName}
                    </span>
                    <span className="ml-auto font-medium tabular-nums">
                      {Math.round(e.weatherOkProb * 100)}%
                    </span>
                  </div>
                ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function SosButton({
  onRaise,
}: {
  onRaise: ReturnType<typeof useStore>["raiseIncident"];
}) {
  const { data } = useStore();
  const [open, setOpen] = React.useState(false);
  const [stationId, setStationId] = React.useState<ID>("st-bharati");
  const [type, setType] = React.useState<Incident["type"]>("medical");
  const [severity, setSeverity] =
    React.useState<Incident["severity"]>("critical");
  const [summary, setSummary] = React.useState(
    "Crew member requires urgent medical evacuation.",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Siren /> Raise SOS
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raise SOS</DialogTitle>
          <DialogDescription>
            Encoded into a compact P0 packet that syncs ahead of all bulk data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Station
              </Label>
              <StationSelect
                stations={data.stations.filter((s) => s.type === "station")}
                value={stationId}
                onChange={setStationId}
                className="mt-1 w-full"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase">
                Type
              </Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Incident["type"])}
                className="mt-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none"
              >
                {[
                  "medical",
                  "fire",
                  "missing_person",
                  "equipment",
                  "weather",
                ].map((t) => (
                  <option key={t} value={t}>
                    {title(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Severity
            </Label>
            <div className="mt-1 flex gap-1.5">
              {(
                ["low", "medium", "high", "critical"] as Incident["severity"][]
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                    severity === s
                      ? SEV_TONE[s]
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase">
              Situation
            </Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1 min-h-16 text-xs"
            />
          </div>
          <Button
            className="w-full gap-1.5"
            onClick={() => {
              onRaise({ type, severity, stationId, summary });
              setOpen(false);
            }}
          >
            <Siren /> Transmit SOS (P0 lane)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IncidentRow({
  incident,
  onAdvance,
}: {
  incident: Incident;
  onAdvance: ReturnType<typeof useStore>["advanceIncident"];
}) {
  const { data, stationById } = useStore();
  const idx = INCIDENT_FLOW.indexOf(incident.status);
  const next =
    idx >= 0 && idx < INCIDENT_FLOW.length - 1 ? INCIDENT_FLOW[idx + 1] : null;
  const actions = data.incidentActions
    .filter((a) => a.incidentId === incident.id)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border",
            SEV_TONE[incident.severity],
          )}
        >
          <Siren className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {title(incident.type)} ·{" "}
            {stationById.get(incident.stationId)?.shortName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {incident.summary}
          </p>
        </div>
        <Pill className={SEV_TONE[incident.severity]}>{incident.severity}</Pill>
        <Pill variant="muted">{title(incident.status)}</Pill>
      </button>

      {open ? (
        <div className="border-t px-3 py-3">
          <StageFlow
            steps={INCIDENT_FLOW}
            activeIndex={idx}
            separator="glyph"
            className="mb-3"
          />

          <div className="mb-3 space-y-1.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-[11px]">
                <Activity className="mt-0.5 size-3 text-muted-foreground" />
                <span className="flex-1 text-muted-foreground">{a.action}</span>
                <span className="shrink-0 text-muted-foreground/70">
                  {fmtDateTime(a.ts)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!next}
              onClick={() =>
                next &&
                onAdvance(
                  incident.id,
                  next,
                  `Advanced to ${title(next)} by incident commander.`,
                )
              }
            >
              Advance → {next ? title(next) : "Closed"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Raised {fmtDateTime(incident.createdAt)} UTC by{" "}
              {incident.reportedBy}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SosPanel({
  origin,
  onRaise,
}: {
  origin: ID;
  onRaise: ReturnType<typeof useStore>["raiseIncident"];
}) {
  const { link, stationById } = useStore();
  const station = stationById.get(origin);
  return (
    <SectionCard
      title="SOS console"
      description={`Priority lane from ${station?.shortName ?? "station"}`}
    >
      <div className="flex flex-col gap-3 rounded-xl border border-foreground/30 bg-foreground/5 p-4">
        <div className="flex items-center gap-2">
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-foreground" />
          </span>
          <span className="text-xs font-medium text-foreground">
            {link === "offline"
              ? "Buffering locally — SOS will jump the queue on reconnect"
              : "Ready to transmit on P0 lane"}
          </span>
        </div>
        <SosButton onRaise={onRaise} />
        <p className="text-[11px] text-muted-foreground">
          One tap raises an incident, opens the muster roll-call and generates
          ranked evacuation options.
        </p>
      </div>
    </SectionCard>
  );
}

function CompactPacketDemo() {
  const { today } = useStore();
  const packet = React.useMemo(() => {
    const station = 3;
    const type = 1;
    const severity = 3;
    const person = 274;
    const lat = Math.round(-69.4 * 1e5);
    const lon = Math.round(76.19 * 1e5);
    const ts = Math.floor(today.getTime() / 1000);
    const bytes = [
      station & 0xff,
      type & 0xff,
      severity & 0xff,
      (person >> 8) & 0xff,
      person & 0xff,
      (lat >>> 24) & 0xff,
      (lat >>> 16) & 0xff,
      (lat >>> 8) & 0xff,
      lat & 0xff,
      (lon >>> 24) & 0xff,
      (lon >>> 16) & 0xff,
      (lon >>> 8) & 0xff,
      lon & 0xff,
      (ts >>> 24) & 0xff,
      (ts >>> 16) & 0xff,
      (ts >>> 8) & 0xff,
      ts & 0xff,
      0x5a,
      0xc3,
    ];
    return bytes;
  }, [today]);

  return (
    <SectionCard
      title="Compact SOS packet"
      description="Fixed binary layout, ~19 bytes, one Iridium SBD message"
    >
      <div className="flex flex-wrap gap-1 font-mono text-[11px]">
        {packet.map((b, i) => (
          <span key={i} className="rounded bg-muted px-1.5 py-0.5">
            {b.toString(16).padStart(2, "0")}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="size-3" /> station 1B · type 1B · severity 1B
        </span>
        <span className="flex items-center gap-1">
          <Radio className="size-3" /> person 2B · lat/lon 8B · ts 4B · CRC 2B
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {packet.length} bytes total. At 2.4 kbps this transmits in well under a
        second while bulk photos queue behind it.
      </p>
    </SectionCard>
  );
}
