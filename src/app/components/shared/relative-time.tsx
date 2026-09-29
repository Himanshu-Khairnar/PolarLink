"use client";

import * as React from "react";
import { relTime } from "@/lib/format";

export function RelativeTime({ value }: { value: string | Date }) {
  const [text, setText] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => setText(relTime(value));
    update();
    const id = window.setInterval(update, 60000);
    return () => window.clearInterval(id);
  }, [value]);

  return <>{text ?? "—"}</>;
}
