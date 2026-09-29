import { consumptionSeries } from "@/lib/data/seed";
import type {
  AutonomyRow,
  Consignment,
  CustodyEvent,
  EvacRoute,
  ID,
  InventoryBatch,
  InventoryItem,
  Leg,
  Risk,
  SimulationResult,
  Station,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Forecasting: additive Holt-Winters triple exponential smoothing    */
/* ------------------------------------------------------------------ */

export interface ForecastPoint {
  day: number;
  value: number;
}

export function forecastSeries(
  series: number[],
  horizon = 90,
  seasonLength = 30
): ForecastPoint[] {
  if (series.length === 0) return [];
  const alpha = 0.35;
  const beta = 0.08;
  const gamma = 0.3;
  const m = Math.min(seasonLength, Math.max(2, Math.floor(series.length / 2)));

  const seasonal: number[] = [];
  let seasonMean = 0;
  for (let i = 0; i < m; i++) {
    const vals = series.filter((_, idx) => idx % m === i);
    const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
    seasonal.push(mean);
    seasonMean += mean;
  }
  seasonMean /= m;
  for (let i = 0; i < m; i++) seasonal[i] = seasonal[i] - seasonMean;

  let level = series.slice(0, m).reduce((a, b) => a + b, 0) / m;
  let trend = (series[series.length - 1] - series[0]) / Math.max(series.length - 1, 1);

  const out: ForecastPoint[] = [];
  for (let i = 0; i < series.length; i++) {
    const s = seasonal[i % m];
    const prevLevel = level;
    level = alpha * (series[i] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[i % m] = gamma * (series[i] - level) + (1 - gamma) * s;
  }

  // Damped trend prevents an extrapolated slope from driving demand to zero.
  const phi = 0.9;
  const floor = Math.max(0, level * 0.35);
  for (let h = 1; h <= horizon; h++) {
    const s = seasonal[(series.length + h - 1) % m];
    const damped = trend * ((1 - Math.pow(phi, h)) / (1 - phi));
    out.push({ day: h, value: Math.max(floor, level + damped + s) });
  }
  return out;
}

/** Average forecast demand per day over the next `window` days. */
export function forecastDailyUse(
  stationId: ID,
  itemId: ID,
  window = 30
): number {
  const series = consumptionSeries(stationId, itemId, 120);
  const fc = forecastSeries(series, window + 5);
  const slice = fc.slice(0, window);
  return slice.reduce((a, b) => a + b.value, 0) / Math.max(slice.length, 1);
}

/* ------------------------------------------------------------------ */
/* Days of Autonomy                                                   */
/* ------------------------------------------------------------------ */

export function computeAutonomy(
  station: Station,
  items: InventoryItem[],
  batches: InventoryBatch[],
  nextResupplyDays: number
): AutonomyRow[] {
  const now = Date.now();
  return items
    .filter((it) => it.category !== "waste")
    .map((item) => {
      const stock = batches
        .filter(
          (b) =>
            b.stationId === station.id &&
            b.itemId === item.id &&
            Date.parse(b.expiryDate) > now
        )
        .reduce((a, b) => a + b.qty, 0);

      const dailyUse = forecastDailyUse(station.id, item.id);
      const daysLeft = dailyUse <= 0 ? 9999 : Math.floor(stock / dailyUse);
      let risk: Risk = "OK";
      if (daysLeft < nextResupplyDays) risk = "CRITICAL";
      else if (daysLeft < nextResupplyDays * 1.25) risk = "WATCH";
      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        critical: item.critical,
        stock: Math.round(stock * 10) / 10,
        dailyUse: Math.round(dailyUse * 100) / 100,
        daysLeft,
        nextResupplyDays,
        risk,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ------------------------------------------------------------------ */
/* Delay anomaly detection (robust z-score on dwell time)             */
/* ------------------------------------------------------------------ */

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function detectAnomalies(
  consignments: Consignment[],
  custody: CustodyEvent[]
): { consignmentId: ID; qr: string; dwellHours: number; z: number }[] {
  const dwell: { id: ID; qr: string; hours: number }[] = [];
  consignments.forEach((cs) => {
    const events = custody
      .filter((c) => c.consignmentId === cs.id)
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
    if (events.length < 2) return;
    const last = Date.parse(events[events.length - 1].ts);
    const first = Date.parse(events[0].ts);
    dwell.push({ id: cs.id, qr: cs.qrCode, hours: (last - first) / 3600000 });
  });
  const clean = dwell.map((d) => d.hours);
  const med = median(clean);
  const mad = median(clean.map((h) => Math.abs(h - med))) || 1;
  return dwell
    .map((d) => {
      const z = (0.6745 * (d.hours - med)) / mad;
      return { consignmentId: d.id, qr: d.qr, dwellHours: Math.round(d.hours), z: Math.round(z * 100) / 100 };
    })
    .filter((d) => d.z > 3.5)
    .sort((a, b) => b.z - a.z);
}

/* ------------------------------------------------------------------ */
/* Evacuation routing (graph + season/weather gates)                  */
/* ------------------------------------------------------------------ */

export interface EvacEdge {
  from: ID;
  to: ID;
  mode: string;
  hours: number;
  seasonOk: boolean;
  weatherOkProb: number;
  medicalCapability: number;
}

export function buildEvacEdges(stations: Station[], legs: Leg[]): EvacEdge[] {
  const edges: EvacEdge[] = [];
  for (const l of legs) {
    const from = stations.find((s) => s.id === l.fromStationId);
    const to = stations.find((s) => s.id === l.toStationId);
    const hours =
      Math.max(
        1,
        (Date.parse(l.plannedArrive) - Date.parse(l.plannedDepart)) / 3600000
      ) || 8;
    const weather = from?.type === "station" || to?.type === "station" ? 0.62 : 0.9;
    const medCap =
      (to?.facilities.includes("Medical bay") ? 3 : to?.facilities.includes("Medical room") ? 2 : 1) +
      (to?.type === "foreign_station" ? 1 : 0);
    // The air/sea network is traversable both ways for an evacuation.
    edges.push({ from: l.fromStationId, to: l.toStationId, mode: l.mode, hours, seasonOk: true, weatherOkProb: weather, medicalCapability: medCap });
    edges.push({ from: l.toStationId, to: l.fromStationId, mode: `${l.mode} (return)`, hours, seasonOk: true, weatherOkProb: weather, medicalCapability: 2 });
  }

  const transfer = (a: ID, b: ID, mode: string, hours: number, cap: number): EvacEdge => ({
    from: a,
    to: b,
    mode,
    hours,
    seasonOk: true,
    weatherOkProb: 0.55,
    medicalCapability: cap,
  });

  edges.push(
    transfer("st-maitri", "st-novo", "Snow traverse (Novo runway)", 4, 4),
    transfer("st-novo", "st-maitri", "Snow traverse (Novo runway)", 4, 3),
    transfer("st-bharati", "st-progress", "Helicopter", 1.2, 4),
    transfer("st-bharati", "st-zhongshan", "Helicopter", 0.8, 5),
    transfer("st-progress", "st-zhongshan", "Helicopter", 0.6, 5),
    transfer("st-zhongshan", "st-progress", "Helicopter", 0.6, 4),
    transfer("st-progress", "st-bharati", "Helicopter", 1.2, 3),
    transfer("st-zhongshan", "st-bharati", "Helicopter", 0.8, 3),
  );
  return edges;
}

export function rankEvacRoutes(
  from: ID,
  stations: Station[],
  edges: EvacEdge[],
  weights = { time: 1, weather: 40, transfers: 6, medical: 8 }
): EvacRoute[] {
  const byFrom = new Map<ID, EvacEdge[]>();
  edges.forEach((e) => {
    if (!byFrom.has(e.from)) byFrom.set(e.from, []);
    byFrom.get(e.from)!.push(e);
  });

  const routes: EvacRoute[] = [];
  const dfs = (
    node: ID,
    hops: string[],
    total: number,
    weather: number
  ) => {
    if (hops.length > 4) return;
    const outs = byFrom.get(node) ?? [];
    for (const e of outs) {
      if (hops.includes(e.to)) continue;
      const nextHops = [...hops, e.to];
      const nTotal = total + e.hours;
      const nWeather = 1 - (1 - weather) * (1 - e.weatherOkProb);
      const dest = stations.find((s) => s.id === e.to);
      if (!dest) continue;
      const betterFacility =
        dest.facilities.includes("Medical bay") || dest.type === "hub" || dest.type === "hq";
      if (betterFacility && nextHops.length >= 2) {
        const gap = dest.type === "hq" ? 0 : dest.type === "hub" ? 1 : 2;
        const hops = nextHops.length - 1;
        const score =
          weights.time * nTotal +
          weights.weather * (1 - nWeather) +
          weights.transfers * hops +
          weights.medical * gap;
        routes.push({
          id: nextHops.join(">"),
          label: nextHops
            .map((h) => stations.find((s) => s.id === h)?.shortName ?? h)
            .join("  \u2192  "),
          hops: nextHops,
          totalHours: Math.round(nTotal * 10) / 10,
          weatherOkProb: Math.round(nWeather * 100) / 100,
          transfers: hops,
          medicalGap: gap,
          feasible: nWeather > 0.35,
          score: Math.round(score * 10) / 10,
        });
      }
      dfs(e.to, nextHops, nTotal, nWeather);
    }
  };
  dfs(from, [from], 0, 0);
  const best = new Map<string, EvacRoute>();
  for (const r of routes) {
    const prev = best.get(r.id);
    if (!prev || r.score < prev.score) best.set(r.id, r);
  }
  return [...best.values()].sort((a, b) => a.score - b.score).slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* What-if season simulator (single-scenario replay + Monte Carlo)    */
/* ------------------------------------------------------------------ */

export function simulateDelay(
  legs: Leg[],
  consignments: Consignment[],
  targetLegId: ID,
  delayDays: number,
  autonomy: Record<ID, AutonomyRow[]>
): SimulationResult {
  const target = legs.find((l) => l.id === targetLegId);
  const affectedLegs = new Set<ID>();
  if (target) {
    affectedLegs.add(target.id);
    legs
      .filter(
        (l) =>
          l.fromStationId === target.toStationId ||
          l.toStationId === target.toStationId
      )
      .forEach((l) => affectedLegs.add(l.id));
  }

  const failed = consignments
    .filter((c) => c.legId && affectedLegs.has(c.legId))
    .map((c) => ({
      consignmentId: c.id,
      description: c.description,
      reason: `${delayDays}-day slip on ${target?.mode ?? "leg"} breaks the ${c.category} window`,
    }));

  const stationImpact = Object.entries(autonomy).flatMap(([stationId, rows]) =>
    rows
      .filter((r) => r.risk !== "OK")
      .slice(0, 3)
      .map((r) => ({
        stationId,
        item: r.name,
        risk: (delayDays >= 10 && r.daysLeft < r.nextResupplyDays + delayDays
          ? "CRITICAL"
          : "WATCH") as Risk,
        shortfallDays: Math.max(0, delayDays - (r.daysLeft - r.nextResupplyDays)),
      }))
  );

  const base = 0.94;
  const confidence = Math.max(0.18, Math.min(0.99, base - delayDays * 0.028 - failed.length * 0.012));

  return {
    delayDays,
    targetLegId,
    confidence: Math.round(confidence * 1000) / 10,
    failedDeliveries: failed,
    stationImpact,
    legs: legs.map((l) => ({
      legId: l.id,
      slippedDays: affectedLegs.has(l.id) ? delayDays : 0,
      missed: affectedLegs.has(l.id),
    })),
  };
}

export function monteCarloSeason(
  legs: Leg[],
  delayMean = 6,
  delaySd = 4,
  runs = 400
): { confidence: number; p50: number; p90: number } {
  const samples: number[] = [];
  let ok = 0;
  for (let i = 0; i < runs; i++) {
    const u = Math.max(Math.random(), 1e-6);
    const v = Math.random();
    const gauss = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const delay = Math.max(0, delayMean + delaySd * gauss);
    samples.push(delay);
    if (delay < 8) ok++;
  }
  samples.sort((a, b) => a - b);
  return {
    confidence: Math.round((ok / runs) * 1000) / 10,
    p50: Math.round(samples[Math.floor(runs * 0.5)] * 10) / 10,
    p90: Math.round(samples[Math.floor(runs * 0.9)] * 10) / 10,
  };
}
