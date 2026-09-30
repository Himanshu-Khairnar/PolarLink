"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { Sidebar, NavList } from "@/app/components/shell/sidebar";
import { Topbar } from "@/app/components/shell/topbar";
import { Copilot } from "@/app/components/shared/copilot";
import { useStore } from "@/lib/store";
import { Snowflake } from "lucide-react";

const SIDEBAR_KEY = "polarlink:sidebar";
let sidebarStore =
  typeof window !== "undefined" &&
  window.localStorage.getItem(SIDEBAR_KEY) === "closed"
    ? false
    : true;
const sidebarListeners = new Set<() => void>();

function subscribeSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

function setSidebarOpen(next: boolean) {
  sidebarStore = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
  }
  sidebarListeners.forEach((listener) => listener());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = React.useState(false);
  const sidebarOpen = React.useSyncExternalStore(
    subscribeSidebar,
    () => sidebarStore,
    () => true,
  );
  const { glare } = useStore();

  React.useEffect(() => {
    document.documentElement.classList.toggle("glare", glare);
  }, [glare]);

  return (
    <div className="flex min-h-svh w-full bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Snowflake className="size-4.5" />
            </span>
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">PolarLink</p>
              <p className="text-[10px] text-muted-foreground">NCPOR · MoES</p>
            </div>
          </div>
          <NavList onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setNavOpen(true)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6">{children}</main>
      </div>
      <Copilot />
    </div>
  );
}
