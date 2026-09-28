"use client";

import * as React from "react";
import { cn } from "cn";

export function ForecastChart({
  history,
  forecast,
  height = 180,
  threshold,
  className,
}: {
  history: number[];
  forecast: { day: number; value: number }[];
  height?: number;
  threshold?: number;
  className?: string;
}) {
  const width = 640;
  const all = [...history, ...forecast.map((f) => f.value)];
  const max = Math.max(...all, threshold ?? 0) * 1.1 || 1;
  const min = 0;
  const total = history.length + forecast.length;
  const x = (i: number) => (i / (total - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * (height - 10) - 5;
  const histPath = history.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fc = forecast.map((f, i) => `${i === 0 ? "M" : "L"}${x(history.length + i).toFixed(1)},${y(f.value).toFixed(1)}`).join(" ");
  const fcArea = `${fc} L${x(total - 1)},${height} L${x(history.length)},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full", className)} preserveAspectRatio="none">
      <defs>
        <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={width} y1={height * g} y2={height * g} className="stroke-border" strokeWidth={1} strokeDasharray="3 5" />
      ))}
      {threshold !== undefined ? (
        <line
          x1={0}
          x2={width}
          y1={y(threshold)}
          y2={y(threshold)}
          className="stroke-red-500/60"
          strokeWidth={1}
          strokeDasharray="5 4"
        />
      ) : null}
      <path d={histPath} fill="none" strokeWidth={2} className="stroke-chart-1" />
      <path d={fcArea} fill="url(#fcGrad)" className="text-chart-1" />
      <path d={fc} fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-chart-3" />
      <line x1={x(history.length)} x2={x(history.length)} y1={0} y2={height} className="stroke-muted-foreground/40" strokeWidth={1} />
    </svg>
  );
}

export function Donut({
  segments,
  size = 120,
  thickness = 12,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; className: string; swatchClassName?: string; label: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const arcs = segments.reduce<{ seg: (typeof segments)[number]; len: number; offset: number }[]>((acc, seg) => {
    const prev = acc.length ? acc[acc.length - 1] : { offset: 0, len: 0 };
    const len = (seg.value / total) * c;
    acc.push({ seg, len, offset: prev.offset + prev.len });
    return acc;
  }, []);
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-muted" />
          {arcs.map(({ seg, len, offset }, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className={cn("stroke-current", seg.className)}
            />
          ))}
        </svg>
        {centerLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-lg font-semibold">{centerLabel}</span>
            {centerSub ? <span className="text-[10px] text-muted-foreground">{centerSub}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={cn("size-2.5 rounded-sm bg-current", s.swatchClassName ?? s.className)} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBars({
  rows,
  max,
  unit,
}: {
  rows: { label: string; value: number; className?: string }[];
  max?: number;
  unit?: string;
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium tabular-nums">
              {Math.round(r.value).toLocaleString("en-IN")}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full bg-foreground/80", r.className)} style={{ width: `${(r.value / top) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
