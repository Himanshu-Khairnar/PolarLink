export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function fmtDate(input: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(d);
}

export function fmtDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

export function relTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const suffix = diff >= 0 ? "ago" : "from now";
  if (mins < 60) return `${mins}m ${suffix}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ${suffix}`;
  return `${Math.round(hours / 24)}d ${suffix}`;
}

export function title(s: string): string {
  return s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function compactBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const RISK_STYLES: Record<string, string> = {
  CRITICAL: "text-red-500 border-red-500/30 bg-red-500/10",
  WATCH: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  OK: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
};
