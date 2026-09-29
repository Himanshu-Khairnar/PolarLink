"use client";

import { cn } from "cn";
import { fnv1a } from "@/lib/hash";

/**
 * Visual QR-style tag. The prototype has no camera pipeline, so this renders a
 * deterministic matrix derived from the custody hash for the field-scan demo.
 */
export function QrTag({ value, size = 128, className }: { value: string; size?: number; className?: string }) {
  const modules = 25;
  const cells: boolean[] = [];
  let seed = parseInt(fnv1a(value), 16) || 1;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < modules * modules; i++) cells.push(next() > 0.5);
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return inBox(0, 0) || inBox(0, modules - 7) || inBox(modules - 7, 0);
  };
  const finderOn = (r: number, c: number) => {
    const local = (br: number, bc: number) => {
      const lr = r - br;
      const lc = c - bc;
      if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
      if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
      return false;
    };
    if (r < 7 && c < 7) return local(0, 0);
    if (r < 7 && c >= modules - 7) return local(0, modules - 7);
    if (r >= modules - 7 && c < 7) return local(modules - 7, 0);
    return false;
  };
  return (
    <div className={cn("relative inline-block rounded-lg bg-white p-2", className)} style={{ width: size + 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`} shapeRendering="crispEdges">
        <rect width={modules} height={modules} fill="#fff" />
        {Array.from({ length: modules * modules }).map((_, i) => {
          const r = Math.floor(i / modules);
          const c = i % modules;
          const on = isFinder(r, c) ? finderOn(r, c) : cells[i];
          if (!on) return null;
          return <rect key={i} x={c} y={r} width={1} height={1} fill="#0a0a0a" />;
        })}
      </svg>
      <p className="mt-1 truncate text-center font-mono text-[9px] text-neutral-700" style={{ maxWidth: size }}>
        {value}
      </p>
    </div>
  );
}
