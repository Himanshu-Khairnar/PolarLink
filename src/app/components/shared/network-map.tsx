"use client";

import * as React from "react";
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { LineString } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import { cn } from "cn";
import type { Leg, Station } from "@/lib/types";

const W = 1000;
const H = 540;

/* Real world coastlines (Natural Earth 110m topojson), projected once. */
const WORLD = feature(
  landTopo as unknown as Topology,
  (landTopo as unknown as Topology).objects.land as GeometryCollection,
) as unknown as GeoPermissibleObjects;

const PROJECTION = geoNaturalEarth1().fitSize([W, H], WORLD);
const toPath = geoPath(PROJECTION);
const LAND_PATH = toPath(WORLD) ?? "";
const GRATICULE_PATH = toPath(geoGraticule().step([30, 30])()) ?? "";

function parallel(lat: number, step = 2): LineString {
  const coordinates: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += step) coordinates.push([lon, lat]);
  return { type: "LineString", coordinates };
}

const EQUATOR_PATH = toPath(parallel(0)) ?? "";
const SEA_ICE_PATH = toPath(parallel(-60)) ?? "";
const REFERENCE_PATHS = [-66.5, -23.5, 23.5, 66.5].map(
  (lat) => toPath(parallel(lat)) ?? "",
);

function project(lat: number, lon: number) {
  const p = PROJECTION([lon, lat]);
  return { x: p ? p[0] : 0, y: p ? p[1] : 0 };
}

type LabelAnchor = "start" | "middle" | "end";
type LabelBox = { x: number; y: number; w: number; h: number };
type LabelPos = { dx: number; dy: number; anchor: LabelAnchor };

const LABEL_CANDIDATES: LabelPos[] = [
  { dx: 11, dy: -6, anchor: "start" },
  { dx: 11, dy: 6, anchor: "start" },
  { dx: 11, dy: -18, anchor: "start" },
  { dx: 11, dy: 18, anchor: "start" },
  { dx: 11, dy: 30, anchor: "start" },
  { dx: -11, dy: -6, anchor: "end" },
  { dx: -11, dy: 6, anchor: "end" },
  { dx: -11, dy: 18, anchor: "end" },
  { dx: 0, dy: -14, anchor: "middle" },
  { dx: 0, dy: 22, anchor: "middle" },
];

const TYPE_ORDER = [
  "station",
  "hq",
  "hub",
  "port",
  "airport",
  "ship",
  "foreign_station",
];

function overlaps(a: LabelBox, b: LabelBox) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function labelBox(px: number, py: number, w: number, c: LabelPos): LabelBox {
  const x =
    c.anchor === "start"
      ? px + c.dx
      : c.anchor === "end"
        ? px + c.dx - w
        : px + c.dx - w / 2;
  return { x, y: py + c.dy - 11, w, h: 14 };
}

/** Greedy label placement so clustered stations (e.g. the Larsemann Hills
 *  trio) never draw their names on top of each other. */
function layoutLabels(stations: Station[]) {
  const boxes: LabelBox[] = [];
  for (const s of stations) {
    const p = project(s.lat, s.lon);
    boxes.push({ x: p.x - 9, y: p.y - 9, w: 18, h: 18 });
  }
  const a1 = project(15, 78);
  boxes.push({ x: a1.x + 14, y: a1.y - 14, w: 220, h: 16 });
  const a2 = project(-62, 20);
  boxes.push({ x: a2.x, y: a2.y - 14, w: 310, h: 16 });

  const result = new Map<string, LabelPos>();
  const ordered = [...stations].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
  );
  for (const s of ordered) {
    const p = project(s.lat, s.lon);
    const w = s.shortName.length * 6.4 + 4;
    let chosen = LABEL_CANDIDATES[0];
    let box = labelBox(p.x, p.y, w, chosen);
    for (const c of LABEL_CANDIDATES) {
      const candidate = labelBox(p.x, p.y, w, c);
      if (!boxes.some((b) => overlaps(candidate, b))) {
        chosen = c;
        box = candidate;
        break;
      }
    }
    boxes.push(box);
    result.set(s.id, chosen);
  }
  return result;
}

const TYPE_TONE: Record<string, string> = {
  station: "fill-primary",
  foreign_station: "fill-muted-foreground",
  hub: "fill-primary/70",
  port: "fill-primary/45",
  airport: "fill-primary/45",
  ship: "fill-primary/60",
  hq: "fill-primary",
};

const STATUS_TONE: Record<string, string> = {
  planned: "stroke-muted-foreground/40",
  loading: "stroke-primary/40",
  in_transit: "stroke-primary/80",
  arrived: "stroke-muted-foreground",
  delayed: "stroke-primary",
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
  const labels = React.useMemo(() => layoutLabels(stations), [stations]);
  const hoverStation = hover ? byId.get(hover) : undefined;
  const hoverPoint = hoverStation ? project(hoverStation.lat, hoverStation.lon) : undefined;

  return (
    <div className={cn("relative overflow-hidden rounded-lg ring-1 ring-foreground/10", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <radialGradient id="mapglow" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter id="routeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#mapglow)" className="text-primary" />

        {/* real coastlines */}
        <path
          d={LAND_PATH}
          className="fill-primary/5 stroke-primary/20"
          strokeWidth={0.75}
          strokeLinejoin="round"
        />

        {/* graticule + reference parallels */}
        <path d={GRATICULE_PATH} fill="none" className="stroke-border/50" strokeWidth={0.5} />
        <path d={EQUATOR_PATH} fill="none" className="stroke-border" strokeWidth={1} />
        {REFERENCE_PATHS.map((d, i) => (
          <path
            key={`ref-${i}`}
            d={d}
            fill="none"
            className="stroke-border/40"
            strokeWidth={0.5}
            strokeDasharray="1 4"
          />
        ))}
        <path
          d={SEA_ICE_PATH}
          fill="none"
          className="stroke-primary/40"
          strokeWidth={1}
          strokeDasharray="2 6"
        />

        {/* region annotations */}
        <text
          x={project(15, 78).x + 14}
          y={project(15, 78).y}
          className="fill-muted-foreground/60 text-[13px] tracking-[0.25em]"
        >
          INDIAN OCEAN ROUTE
        </text>
        <text
          x={project(-62, 20).x}
          y={project(-62, 20).y}
          className="fill-muted-foreground/60 text-[13px] tracking-[0.25em]"
        >
          SEA-ICE EDGE · SOUTHERN OCEAN
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
                strokeLinecap="round"
                filter={active ? "url(#routeGlow)" : undefined}
                className={cn(STATUS_TONE[r.status] ?? "stroke-muted-foreground/40", active && "dash")}
              />
              {active ? (
                <circle r="4" className="fill-primary">
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
                  strokeLinecap="round"
                  className="stroke-primary"
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
          const label = labels.get(s.id) ?? LABEL_CANDIDATES[0];
          const emphasized = isHighlight || onRoute;
          return (
            <g
              key={s.id}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              {emphasized ? (
                <circle cx={p.x} cy={p.y} r="14" className="fill-primary/20 pulse-ring" />
              ) : null}
              {s.type === "ship" ? (
                <rect
                  x={p.x - 5}
                  y={p.y - 5}
                  width={10}
                  height={10}
                  rx={1.5}
                  transform={`rotate(45 ${p.x} ${p.y})`}
                  className="fill-primary/60 stroke-background"
                  strokeWidth={2}
                />
              ) : (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHover ? 8 : 6}
                  className={cn(TYPE_TONE[s.type] ?? "fill-primary", "stroke-background")}
                  strokeWidth={2}
                />
              )}
              <text
                x={p.x + label.dx}
                y={p.y + label.dy}
                textAnchor={label.anchor}
                strokeWidth={3}
                className={cn(
                  "stroke-background [paint-order:stroke] text-[12px]",
                  emphasized
                    ? "fill-primary font-semibold"
                    : "fill-foreground font-medium",
                )}
              >
                {s.shortName}
              </text>
            </g>
          );
        })}

        {hoverStation && hoverPoint
          ? (() => {
              const tw = Math.max(150, hoverStation.name.length * 6.5);
              const flip = hoverPoint.x + 10 + tw > W - 8;
              const tx = flip ? hoverPoint.x - 10 - tw : hoverPoint.x + 10;
              const ty = Math.min(hoverPoint.y + 10, H - 56);
              return (
                <g className="pointer-events-none">
                  <rect
                    x={tx}
                    y={ty}
                    width={tw}
                    height={46}
                    rx={8}
                    className="fill-popover stroke-border"
                    strokeWidth={1}
                  />
                  <text x={tx + 10} y={ty + 20} className="fill-foreground text-[12px] font-semibold">
                    {hoverStation.name}
                  </text>
                  <text x={tx + 10} y={ty + 36} className="fill-muted-foreground text-[11px]">
                    {hoverStation.type.replaceAll("_", " ")} · cap {hoverStation.capacity}
                  </text>
                </g>
              );
            })()
          : null}
      </svg>
      <div className="pointer-events-none absolute top-3 right-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-background/80 px-3 py-2 text-[10px] text-muted-foreground ring-1 ring-border backdrop-blur">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-primary ring-2 ring-background" /> Station</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-muted-foreground ring-2 ring-background" /> Foreign / partner</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-primary/70 ring-2 ring-background" /> Gateway hub</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rotate-45 rounded-[2px] bg-primary/60 ring-2 ring-background" /> Vessel</span>
      </div>
    </div>
  );
}

function runtimeRoutes(legs: Leg[], byId: Map<string, Station>) {
  return legs.filter((l) => byId.has(l.fromStationId) && byId.has(l.toStationId));
}
