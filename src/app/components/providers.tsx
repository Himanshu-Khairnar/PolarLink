"use client";

import * as React from "react";
import { Toaster } from "@/app/components/ui/sonner";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <TooltipProvider delay={200}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </StoreProvider>
  );
}
