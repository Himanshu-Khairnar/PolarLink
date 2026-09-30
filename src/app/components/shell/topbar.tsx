"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useStore, type LinkMode } from "@/lib/store";
import { PAGES } from "@/app/components/shell/nav";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Separator } from "@/app/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Badge } from "@/app/components/ui/badge";
import {
  Bell,
  ChevronDown,
  Lock,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  ShieldHalf,
  Snowflake,
  UserCog,
} from "lucide-react";
import { RelativeTime } from "@/app/components/shared/relative-time";
import { ROLES, ROLE_ORDER } from "@/lib/roles";

const LINK_OPTIONS: { value: LinkMode; label: string }[] = [
  { value: "online", label: "VSAT" },
  { value: "throttled", label: "2.4 kbps" },
  { value: "offline", label: "Offline" },
];

function Clock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 1000);
    const initial = setTimeout(tick, 0);
    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, []);
  if (!now) return <div className="hidden h-8 w-28 xl:block" />;
  const utc = now.toISOString().slice(11, 19);
  const ist = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(now);
  return (
    <div className="hidden items-center gap-3 rounded-lg border px-3 py-1.5 text-xs xl:flex">
      <div className="leading-tight">
        <p className="text-[9px] tracking-wide text-muted-foreground uppercase">
          Goa
        </p>
        <p className="font-mono tabular-nums">{ist}</p>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <div className="leading-tight">
        <p className="text-[9px] tracking-wide text-muted-foreground uppercase">
          UTC
        </p>
        <p className="font-mono tabular-nums">{utc}</p>
      </div>
    </div>
  );
}

export function Topbar({
  onMenu,
  sidebarOpen = true,
  onToggleSidebar,
}: {
  onMenu: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}) {
  const pathname = usePathname();
  const page = PAGES[pathname] ?? { title: "PolarLink", subtitle: "" };
  const {
    data,
    stationById,
    role,
    setRole,
    logout,
    scope,
    setScope,
    link,
    setLink,
    glare,
    setGlare,
  } = useStore();

  const alerts = data.alerts;
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const scopedStations = data.stations.filter((s) => s.type === "station");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-xl sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-sm font-semibold tracking-tight sm:text-base">
          {page.title}
        </h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">
          {page.subtitle}
        </p>
      </div>

      <Clock />

      <div className="flex items-center gap-1 rounded-lg border p-0.5">
        {LINK_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setLink(o.value)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              link === o.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 md:flex">
        <Snowflake className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Glare</span>
        <Switch
          size="sm"
          checked={glare}
          onCheckedChange={(v) => setGlare(Boolean(v))}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="relative gap-1.5">
              <Bell />
              <span className="hidden sm:inline">Alerts</span>
              {critical > 0 ? (
                <Badge
                  variant="outline"
                  className="ml-0.5 h-4 border-transparent bg-primary px-1 text-[10px] text-primary-foreground"
                >
                  {critical}
                </Badge>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Active alerts</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {alerts.slice(0, 6).map((a) => (
            <DropdownMenuItem
              key={a.id}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <div className="flex w-full items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    a.severity === "critical"
                      ? "bg-primary"
                      : a.severity === "warning"
                        ? "bg-primary/50"
                        : "bg-muted-foreground/50",
                  )}
                />
                <span className="text-xs font-medium">{a.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  <RelativeTime value={a.ts} />
                </span>
              </div>
              <span className="pl-3.5 text-[11px] text-muted-foreground">
                {a.detail}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {ROLES[role].scope === "all" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Radio className="hidden sm:block" />
                <span className="hidden max-w-28 truncate sm:inline">
                  {scope === "all"
                    ? "All stations"
                    : stationById.get(scope)?.shortName}
                </span>
                <ChevronDown />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Station scope</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setScope("all")}>
              All stations
            </DropdownMenuItem>
            {scopedStations.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => setScope(s.id)}>
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
          title="Scope is fixed by your role"
        >
          <Lock className="size-3.5 text-muted-foreground" />
          <span className="max-w-28 truncate text-muted-foreground">
            {stationById.get(scope)?.shortName ?? "Scoped"}
          </span>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5">
              <UserCog />
              <span className="hidden max-w-32 truncate lg:inline">
                {ROLES[role].label}
              </span>
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <ShieldHalf className="size-3.5" /> Role-based access
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLE_ORDER.map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => setRole(r)}
              className={cn(role === r && "bg-accent")}
            >
              {ROLES[r].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="gap-2">
            <LogOut className="size-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
