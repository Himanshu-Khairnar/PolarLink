"use client";

import * as React from "react";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RISK_STYLES } from "@/lib/format";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <div className="space-y-0.5">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}

const STAT_TONE = {
  default: "text-muted-foreground",
  critical: "text-red-500",
  watch: "text-amber-500",
  ok: "text-emerald-500",
} as const;

/**
 * A single unified panel that lays out a row of <Stat> cells separated by
 * hairline dividers. Use this for every KPI row so the whole app reads the same.
 */
export function StatStrip({
  children,
  className,
  cols = "grid-cols-2 lg:grid-cols-4",
}: {
  children: React.ReactNode;
  className?: string;
  cols?: string;
}) {
  return (
    <Card className={cn("[--card-spacing:0px]", className)}>
      <div className={cn("grid gap-px bg-border", cols)}>{children}</div>
    </Card>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  trend,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  trend?: { value: string; dir: "up" | "down" | "flat" };
  icon?: React.ReactNode;
  tone?: "default" | "critical" | "watch" | "ok";
}) {
  const accent = STAT_TONE[tone];
  return (
    <div className="flex flex-col justify-between gap-2 bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        {icon ? <span className={cn("shrink-0", accent)}>{icon}</span> : null}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-heading text-2xl leading-none font-semibold tabular-nums">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        {trend ? (
          <span
            className={cn(
              "ml-1 text-[11px] font-medium",
              trend.dir === "up" && "text-emerald-500",
              trend.dir === "down" && "text-red-500",
              trend.dir === "flat" && "text-muted-foreground"
            )}
          >
            {trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "–"} {trend.value}
          </span>
        ) : null}
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  className,
  variant = "outline",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "outline" | "muted" | "solid";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-full px-2 text-[11px] font-medium",
        variant === "muted" && "border-transparent bg-muted text-muted-foreground",
        variant === "solid" && "border-transparent bg-foreground text-background",
        className
      )}
    >
      {children}
    </Badge>
  );
}

export function RiskBadge({ risk, className }: { risk: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 rounded-full border px-2 text-[11px] font-semibold", RISK_STYLES[risk], className)}
    >
      {risk}
    </Badge>
  );
}

export function Bar({
  value,
  max,
  className,
  barClassName,
}: {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(2, (value / max) * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full bg-foreground/80 transition-all", barClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LiveDot({ className, tone = "emerald" }: { className?: string; tone?: "emerald" | "amber" | "red" }) {
  const color = tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={cn("relative flex size-2", className)}>
      <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 pulse-ring", color)} />
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
