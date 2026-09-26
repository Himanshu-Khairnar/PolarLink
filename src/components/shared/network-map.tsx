"use client";

import * as React from "react";
import { cn } from "cn";
import type { Leg, Station } from "@/lib/types";

const W = 1000;
const H = 620;
const LON_MIN = -25;
const LON_MAX = 100;
const LAT_MIN = -82;
const LAT_MAX = 86;

function project(lat: number, lon: number) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  return { x, y };
}

const TYPE_TONE: Record<string, string> = {
  station: "fill-sky-500",
  foreign_station: "fill-violet-500",
  hub: "fill-amber-500",
  port: "fill-teal-500",
  airport: "fill-teal-500",
  ship: "fill-emerald-500",
  hq: "fill-foreground",
};

const STATUS_TONE: Record<string, string> = {
  planned: "stroke-muted-foreground/40",
  loading: "stroke-amber-500/70",
  in_transit: "stroke-sky-500/80",
  arrived: "stroke-emerald-500/60",
  delayed: "stroke-red-500/80",
};

export function NetworkMap({
  stations,
  legs,
  highlightStationId,
  routeHops,
  className,
}: {
  stations: Station[];
  legs: Leg[];
  highlightStationId?: string;
  routeHops?: string[];
  className?: string;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  const byId = React.useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg ring-1 ring-foreground/10", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" className="stroke-foreground/5" strokeWidth="1" />
          </pattern>
          <radialGradient id="mapglow" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#mapgrid)" />
        <rect width={W} height={H} fill="url(#mapglow)" className="text-foreground" />

        {/* region annotations */}
        <text x={project(15, 78).x + 14} y={project(15, 78).y} className="fill-muted-foreground/60 text-[14px]">
          INDIAN OCEAN ROUTE
        </text>
        <text x={project(-62, 20).x} y={project(-62, 20).y} className="fill-muted-foreground/60 text-[14px]">
          SOUTHERN OCEAN / SEA-ICE EDGE
        </text>

        {runtimeRoutes(legs, byId).map((r) => {
          const a = byId.get(r.fromStationId);
          const b = byId.get(r.toStationId);
          if (!a || !b) return null;
          const p1 = project(a.lat, a.lon);
          const p2 = project(b.lat, b.lon);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const curve = Math.min(80, len * 0.18);
          const cx = mx - (dy / len) * curve;
          const cy = my + (dx / len) * curve;
          const path = `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`;
          const active = r.status === "in_transit" || r.status === "loading";
          return (
            <g key={r.id}>
              <path
                d={path}
                fill="none"
                strokeWidth={2}
                className={cn(STATUS_TONE[r.status] ?? "stroke-muted-foreground/40", active && "dash")}
              />
              {active ? (
                <circle r="4" className="fill-sky-500">
                  <animateMotion dur="5s" repeatCount="indefinite" path={path} />
                </circle>
              ) : null}
            </g>
          );
        })}

        {routeHops && routeHops.length > 1
          ? routeHops.slice(0, -1).map((hop, i) => {
              const a = byId.get(hop);
              const b = byId.get(routeHops[i + 1]);
              if (!a || !b) return null;
              const p1 = project(a.lat, a.lon);
              const p2 = project(b.lat, b.lon);
              return (
                <line
                  key={i}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  strokeWidth={3}
                  className="stroke-red-500"
                  strokeDasharray="6 4"
                />
              );
            })
          : null}

        {stations.map((s) => {
          const p = project(s.lat, s.lon);
          const isHover = hover === s.id;
          const isHighlight = highlightStationId === s.id;
          const onRoute = routeHops?.includes(s.id);
          return (
            <g
              key={s.id}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              {isHighlight || onRoute ? (
                <circle cx={p.x} cy={p.y} r="14" className="fill-red-500/30 pulse-ring" />
              ) : null}
              <circle cx={p.x} cy={p.y} r={isHover ? 8 : 6} className={cn(TYPE_TONE[s.type] ?? "fill-foreground", "stroke-background")} strokeWidth={2} />
              <text
                x={p.x + 11}
                y={p.y + 4}
                className={cn("text-[13px] font-medium", isHighlight || onRoute ? "fill-red-500" : "fill-foreground")}
              >
                {s.shortName}
              </text>
              {isHover ? (
                <g>
                  <rect x={p.x + 10} y={p.y + 10} width={Math.max(150, s.name.length * 6.5)} height={42} rx={6} className="fill-popover stroke-border" strokeWidth={1} />
                  <text x={p.x + 20} y={p.y + 28} className="fill-foreground text-[12px] font-semibold">
                    {s.name}
                  </text>
                  <text x={p.x + 20} y={p.y + 44} className="fill-muted-foreground text-[11px]">
                    {s.type.replaceAll("_", " ")} · cap {s.capacity}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute right-3 bottom-3 flex flex-wrap gap-3 rounded-md bg-background/70 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-sky-500" /> Station</span>
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-violet-500" /> Foreign / partner</span>
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-500" /> Gateway hub</span>
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-emerald-500" /> Vessel</span>
      </div>
    </div>
  );
}

function runtimeRoutes(legs: Leg[], byId: Map<string, Station>) {
  return legs.filter((l) => byId.has(l.fromStationId) && byId.has(l.toStationId));
}
