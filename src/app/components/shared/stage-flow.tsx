import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import { title } from "@/lib/format";

export function StageFlow({
  steps,
  activeIndex,
  separator = "chevron",
  className,
}: {
  steps: string[];
  activeIndex: number;
  separator?: "chevron" | "glyph";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {steps.map((step, i) => (
        <Fragment key={step}>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
              i <= activeIndex
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {title(step)}
          </span>
          {i < steps.length - 1 ? (
            separator === "chevron" ? (
              <ChevronRight className="size-3 text-muted-foreground/50" />
            ) : (
              <span className="text-muted-foreground/40">›</span>
            )
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
