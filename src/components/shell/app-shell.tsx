"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, NavList } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { useStore } from "@/lib/store";
import { Snowflake } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = React.useState(false);
  const { glare } = useStore();

  React.useEffect(() => {
    document.documentElement.classList.toggle("glare", glare);
  }, [glare]);

  return (
    <div className="flex min-h-svh w-full bg-background">
      <Sidebar />
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
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
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
