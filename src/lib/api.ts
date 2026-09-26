/**
 * Thin client for the PolarLink FastAPI service.
 *
 * The dashboard ships with a complete client-side synthetic store, so the demo
 * never hard-depends on the API. These helpers let the same UI enrich itself
 * from the real backend (forecasts, evacuation ranking, simulation) when it is
 * reachable, proxied through Next.js at /api/backend.
 */

const BASE = "/api/backend";

export interface BackendHealth {
  status: string;
  node: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} ${res.statusText} for ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<BackendHealth>("/health"),
  stations: () => request<unknown[]>("/stations"),
  expeditions: () => request<unknown[]>("/expeditions"),
  consignments: () => request<unknown[]>("/consignments"),
  autonomy: (stationId: string) => request<unknown[]>(`/stations/${stationId}/autonomy`),
  alerts: (stationId: string) => request<unknown[]>(`/stations/${stationId}/alerts`),
  forecast: (stationId: string, item: string, horizon = 90) =>
    request<{ history: number[]; forecast: { day: number; value: number }[]; method: string }>(
      `/forecast/${stationId}/${item}?horizon=${horizon}`
    ),
  simulate: (targetLegId: string, delayDays: number, runs = 400) =>
    request<unknown>("/simulate/season", {
      method: "POST",
      body: JSON.stringify({ target_leg_id: targetLegId, delay_days: delayDays, runs }),
    }),
  evacOptions: (stationId: string) => request<unknown[]>(`/evac/options?station_id=${stationId}`),
  evacForIncident: (incidentId: string) => request<unknown[]>(`/incidents/${incidentId}/evac-options`),
  anomalies: () => request<unknown[]>("/anomalies"),
  wasteCompliance: () => request<Record<string, number>>("/waste/compliance"),
  weather: (stationId: string) => request<Record<string, unknown>>(`/weather/${stationId}`),
};

export async function pingBackend(): Promise<BackendHealth | null> {
  try {
    return await api.health();
  } catch {
    return null;
  }
}
