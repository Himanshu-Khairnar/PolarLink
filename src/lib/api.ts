/**
 * Thin client for the PolarLink FastAPI service.
 *
 * The dashboard ships with a complete client-side synthetic store, so the demo
 * never hard-depends on the API. This helper lets the shell report whether the
 * real backend is reachable, proxied through Next.js at /api/backend.
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

export async function pingBackend(): Promise<BackendHealth | null> {
  try {
    return await request<BackendHealth>("/health");
  } catch {
    return null;
  }
}
