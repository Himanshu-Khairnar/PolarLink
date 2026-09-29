import type { ReactNode } from "react";
import { cn } from "cn";

const TONE_TEXT = {
  default: "",
  ok: "",
  watch: "text-foreground/70",
  critical: "text-foreground",
} as const;

export function Field({
  label,
  value,
  tone = "default",
  variant = "tile",
  className,
  labelClassName,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: keyof typeof TONE_TEXT;
  variant?: "tile" | "plain" | "row";
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  if (variant === "row") {
    return (
      <div className={cn("flex items-center justify-between gap-3 border-b pb-1.5 last:border-0", className)}>
        <span className={cn("text-xs text-muted-foreground", labelClassName)}>{label}</span>
        <span className={cn("text-right text-xs font-medium", valueClassName)}>{value}</span>
      </div>
    );
  }

  if (variant === "plain") {
    return (
      <div className={className}>
        <p className={cn("text-[10px] tracking-wide text-muted-foreground uppercase", labelClassName)}>{label}</p>
        <p className={cn("mt-0.5 font-medium", valueClassName)}>{value}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border px-2 py-1.5", className)}>
      <p className={cn("text-[9px] tracking-wide text-muted-foreground uppercase", labelClassName)}>{label}</p>
      <p className={cn("mt-0.5 text-xs font-semibold", TONE_TEXT[tone], valueClassName)}>{value}</p>
    </div>
  );
}
