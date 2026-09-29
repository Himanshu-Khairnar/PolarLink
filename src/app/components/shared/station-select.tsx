import { cn } from "cn";
import type { ID, Station } from "@/lib/types";

export function StationSelect({
  stations,
  value,
  onChange,
  label = "shortName",
  prefix = "",
  className,
}: {
  stations: Station[];
  value: ID;
  onChange: (id: ID) => void;
  label?: "shortName" | "name";
  prefix?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-md border bg-transparent px-2 text-xs outline-none focus-visible:border-ring",
        className
      )}
    >
      {stations.map((s) => (
        <option key={s.id} value={s.id}>
          {prefix}
          {s[label]}
        </option>
      ))}
    </select>
  );
}
