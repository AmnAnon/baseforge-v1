// src/lib/env-config.ts
// Central production env resolution — keep cache, rate limits, and health in sync.

export type CacheBackend = "memory" | "postgres";

/**
 * Resolve cache/rate-limit backend.
 * - Explicit "memory" only in non-production (or when DATABASE_URL is missing).
 * - Legacy "upstash" maps to postgres.
 * - Production + DATABASE_URL always uses postgres (ignores mistaken CACHE_BACKEND=memory).
 */
export function resolveCacheBackend(): CacheBackend {
  const raw = (process.env.CACHE_BACKEND ?? "").trim().toLowerCase();
  const hasDb = Boolean(process.env.DATABASE_URL);
  const isProd = process.env.NODE_ENV === "production";

  if (raw === "upstash" || raw === "postgres") return "postgres";
  if (raw === "memory") {
    if (isProd && hasDb) return "postgres";
    return "memory";
  }
  if (hasDb) return "postgres";
  return "memory";
}

/** True when background jobs run via Vercel Cron instead of WORKER_URL. */
export function usesCronBackgroundJobs(): boolean {
  return Boolean(process.env.CRON_SECRET) && !process.env.WORKER_URL;
}

export const DEFILLAMA_HEALTH_URL = "https://api.llama.fi/protocols";