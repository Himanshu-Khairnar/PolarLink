/**
 * Deterministic, dependency-free digest for the browser demo's tamper-evident
 * custody ledger. It is an 8x salted FNV-1a construction, not SHA-256, and is
 * intentionally self-consistent only within the client store: the FastAPI
 * service uses real SHA-256 over its own canonical string. To verify a chain
 * that was written by the backend, call GET /consignments/{id}/verify.
 */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 64-char digest assembled from four independently salted FNV passes. */
export function digest(...parts: (string | number)[]): string {
  const canonical = parts.join("|");
  return (
    fnv1a(canonical) +
    fnv1a("a:" + canonical) +
    fnv1a("b:" + canonical) +
    fnv1a("c:" + canonical) +
    fnv1a("d:" + canonical) +
    fnv1a("e:" + canonical) +
    fnv1a("f:" + canonical) +
    fnv1a("g:" + canonical)
  );
}

export function shortHash(hash: string, len = 10): string {
  return hash.slice(0, len);
}

export const GENESIS_HASH = "0".repeat(64);
