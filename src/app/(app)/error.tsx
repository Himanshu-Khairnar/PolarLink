"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-500">
        <AlertTriangle className="size-6" />
      </span>
      <div className="space-y-1">
        <h2 className="font-heading text-base font-semibold">This view failed to render</h2>
        <p className="max-w-md text-xs text-muted-foreground">
          The local plan data is intact. Retry to re-render this segment
          {error.digest ? ` (ref ${error.digest})` : ""}.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => retry()} className="gap-1.5">
        <RefreshCw /> Retry
      </Button>
    </div>
  );
}
