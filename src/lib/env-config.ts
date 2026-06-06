// src/lib/env-config.ts
// Central production env resolution — keep cache, rate limits, and health in sync.

export type CacheBackend = "memory" | "postgres";

/** True on any Vercel deployment (production, preview, or dev). */
export function isVercelDeploy(): boolean {
  return process.env.VERCEL === "1";
}

/**
 * Environments where per-process memory cache is unsafe (serverless / multi-instance).
 * Vercel isolates memory per function instance — CACHE_BACKEND=memory cannot share state.
 */
export function requiresSharedCache(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (isVercelDeploy()) return true;
  return false;
}

/**
 * Resolve cache/rate-limit backend.
 * - Explicit "memory" only for local dev/test (not production, not Vercel).
 * - Legacy "upstash" maps to postgres.
 * - Shared-cache environments always resolve to postgres (requires DATABASE_URL).
 */
export function resolveCacheBackend(): CacheBackend {
  const raw = (process.env.CACHE_BACKEND ?? "").trim().toLowerCase();
  const hasDb = Boolean(process.env.DATABASE_URL);

  if (raw === "upstash" || raw === "postgres") return "postgres";
  if (hasDb) return "postgres";
  if (requiresSharedCache()) return "postgres";
  if (raw === "memory" || raw === "") return "memory";
  return "memory";
}

/** Non-null when cache cannot work (missing DATABASE_URL on serverless/production). */
export function getCacheMisconfiguration(): string | null {
  const hasDb = Boolean(process.env.DATABASE_URL);
  if (requiresSharedCache() && !hasDb) {
    const where = isVercelDeploy() ? "Vercel serverless" : "production";
    return `DATABASE_URL required for shared cache on ${where} — per-instance memory is not shared across function instances`;
  }
  return null;
}

/** True when background jobs run via Vercel Cron instead of WORKER_URL. */
export function usesCronBackgroundJobs(): boolean {
  return Boolean(process.env.CRON_SECRET) && !process.env.WORKER_URL;
}

export const DEFILLAMA_HEALTH_URL = "https://api.llama.fi/protocols";