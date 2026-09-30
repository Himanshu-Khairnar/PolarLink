"use client";

import * as React from "react";
import {
  Boxes,
  Compass,
  HeartPulse,
  LayoutDashboard,
  Ship,
  Snowflake,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLES, ROLE_ORDER, type RoleDef } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { cn } from "cn";

const ICONS: Record<Role, LucideIcon> = {
  hq_logistics: LayoutDashboard,
  expedition_leader: Compass,
  station_leader: Users,
  inventory_keeper: Boxes,
  medical_officer: HeartPulse,
  ship_air_ops: Ship,
  member: UserRound,
};

export function LoginScreen() {
  const { login, stationById } = useStore();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-3xl space-y-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Snowflake className="size-6" />
          </span>
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              PolarLink
            </h1>
            <p className="text-sm text-muted-foreground">
              NCPOR · MoES · Integrated Polar Expedition Logistics
            </p>
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Choose a role to enter the command centre. What you can see and do
            is scoped to that role and its station.
          </p>
        </header>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {ROLE_ORDER.map((role) => (
            <RoleCard
              key={role}
              role={role}
              def={ROLES[role]}
              scopeLabel={
                ROLES[role].scope === "all"
                  ? "All stations"
                  : stationById.get(ROLES[role].scope as string)?.name ??
                    ROLES[role].scope
              }
              onPick={() => login(role)}
            />
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/80">
          Offline-first · hash-chained custody · synthetic 46-ISEA seed. No
          password required for the demo.
        </p>
      </div>
    </div>
  );
}

function RoleCard({
  role,
  def,
  scopeLabel,
  onPick,
}: {
  role: Role;
  def: RoleDef;
  scopeLabel: string;
  onPick: () => void;
}) {
  const Icon = ICONS[role];
  const readOnly = def.actions !== "all" && def.actions.length === 0;
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
        "hover:border-primary/30 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{def.label}</span>
          {readOnly ? (
            <span className="shrink-0 rounded-full border px-1.5 text-[9px] font-semibold text-muted-foreground uppercase">
              view
            </span>
          ) : null}
        </span>
        <span className="block text-[11px] leading-relaxed text-muted-foreground">
          {def.blurb}
        </span>
        <span className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground/80">
          <span className="size-1.5 rounded-full bg-primary/50" />
          Scope: {scopeLabel}
        </span>
      </span>
    </button>
  );
}
