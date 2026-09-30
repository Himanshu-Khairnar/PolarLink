"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { NAV } from "@/app/components/shell/nav";
import { useStore } from "@/lib/store";
import { LiveDot } from "@/app/components/shared/kit";
import { Button } from "@/app/components/ui/button";
import { pingBackend } from "@/lib/api";
import { PanelLeftClose, ShieldCheck, Snowflake } from "lucide-react";

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useStore();
  const criticalIncidents = data.incidents.filter(
    (i) =>
      (i.severity === "critical" || i.severity === "high") &&
      i.status !== "RESOLVED" &&
      i.status !== "REVIEWED",
  ).length;

  const groups: ("Operations" | "Intelligence")[] = [
    "Operations",
    "Intelligence",
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 no-scrollbar">
      {groups.map((group) => (
        <div key={group} className="space-y-1">
          <p className="px-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            {group}
          </p>
          {NAV.filter((n) => n.group === group).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="leading-snug">{item.label}</span>
                {item.href === "/emergency" && criticalIncidents > 0 ? (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 text-[10px] font-semibold",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary/15 text-foreground",
                    )}
                  >
                    {criticalIncidents}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Sidebar({
  open = true,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const { link } = useStore();
  const linkTone =
    link === "online" ? "emerald" : link === "throttled" ? "amber" : "red";
  const [apiOnline, setApiOnline] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let active = true;
    pingBackend().then((health) => {
      if (active) setApiOnline(Boolean(health));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 h-svh shrink-0 flex-col border-r bg-sidebar",
        open ? "hidden w-64 lg:flex" : "hidden",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Snowflake className="size-4.5" />
        </span>
        <div className="leading-tight">
          <p className="font-heading text-sm font-semibold tracking-tight">
            PolarLink
          </p>
          <p className="text-[10px] text-muted-foreground">NCPOR · MoES</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto text-muted-foreground"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <NavList />
      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs">
          <LiveDot tone={linkTone} />
          <span className="text-muted-foreground">
            Link: <span className="font-medium text-foreground">{link}</span>
          </span>
          <ShieldCheck className="ml-auto size-3.5 text-muted-foreground" />
        </div>
        <div className="mt-1.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground/80">
          <span
            className={cn(
              "size-1.5 rounded-full",
              apiOnline === null
                ? "bg-muted-foreground/50"
                : apiOnline
                  ? "bg-primary"
                  : "bg-primary/40",
            )}
          />
          {apiOnline === null
            ? "Checking AI service…"
            : apiOnline
              ? "FastAPI AI service online"
              : "AI service offline · using local engine"}
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground/70">
          Offline-first · event-log sync · hash-chained custody · synthetic
          46-ISEA seed
        </p>
      </div>
    </aside>
  );
}
