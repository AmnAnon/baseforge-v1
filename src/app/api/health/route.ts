// src/app/api/health/route.ts
// Health check endpoint — cache status, upstream API status, DB connectivity
// Used by deployment platforms and monitoring systems.

import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { getIndexerHealth } from "@/lib/data/indexers";
import { circuitBreakers } from "@/lib/circuit-breaker";

interface HealthStatus {
  status: "ok" | "degraded" | "unhealthy";
  checks: Record<string, { status: "ok" | "error" | "unreachable"; latency?: number; detail?: string }>;
  circuitBreakers?: Record<string, { state: string; failures: number; cooldownMs: number }>;
  uptimeSeconds: number;
  timestamp: number;
}

const START_TIME = Date.now();

async function checkUpstream(url: string, label: string, timeoutMs = 5000): Promise<{ status: "ok" | "error"; latency?: number; detail?: string }> {
  try {
    const start = Date.now();
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    const latency = Date.now() - start;
    if (res.ok) {
      return { status: "ok", latency };
    }
    return { status: "error", latency, detail: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { status: "error", detail: e instanceof Error ? e.message : "unknown" };
  }
}

async function checkDatabase(): Promise<{ status: "ok" | "error"; latency?: number; detail?: string }> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { status: "error", detail: "DATABASE_URL not set" };
    }
    const start = Date.now();
    const { db } = await import("@/lib/db/client");
    if (!db) {
      return { status: "error", detail: "DB client is undefined" };
    }
    await db.execute("SELECT 1");
    return { status: "ok", latency: Date.now() - start };
  } catch (e: unknown) {
    return { status: "error", detail: e instanceof Error ? e.message : "unknown" };
  }
}

export async function GET() {
  const checks: HealthStatus["checks"] = {};

  // Check upstream APIs
  const llamaCheck = await checkUpstream("https://api.llama.fi/healthy", "DefiLlama");
  checks.defillama = llamaCheck;

  const coingeckoCheck = await checkUpstream(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    "CoinGecko"
  );
  checks.coingecko = coingeckoCheck;

  const cacheStats = cache.stats();
  const cacheBackend = process.env.CACHE_BACKEND || "memory";
  const isProd = process.env.NODE_ENV === "production";

  // Warn if using memory cache in production
  if (isProd && cacheBackend === "memory") {
    checks.cache = {
      status: "error",
      detail: "MEMORY cache in production — set CACHE_BACKEND=upstash for prod",
    };
  } else {
    checks.cache = {
      status: "ok",
      detail: `backend=${cacheBackend}, size=${cacheStats.size}, hitRate=${(cacheStats.hitRate * 100).toFixed(1)}%`,
    };
  }

  // Check DB only if URL is set
  if (process.env.DATABASE_URL) {
    checks.database = await checkDatabase();
  }

  // Check indexer health
  try {
    const indexerHealth = await getIndexerHealth();
    checks.indexer_primary = {
      status: indexerHealth.primary.healthy ? "ok" : "error",
      latency: indexerHealth.primary.latencyMs,
      detail: `${indexerHealth.primary.provider} block=${indexerHealth.primary.lastBlock} lag=${indexerHealth.primary.lag}`,
    };
    checks.indexer_fallback = {
      status: indexerHealth.fallback.healthy ? "ok" : "error",
      latency: indexerHealth.fallback.latencyMs,
      detail: `${indexerHealth.fallback.provider} block=${indexerHealth.fallback.lastBlock}`,
    };
    checks.indexer_active = {
      status: "ok",
      detail: `active_provider=${indexerHealth.activeProvider}`,
    };
  } catch {
    checks.indexer = { status: "error", detail: "Health check failed" };
  }

  // Check Railway worker
  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  let workerUnreachable = false;
  if (workerUrl) {
    try {
      const start = Date.now();
      const res = await fetch(`${workerUrl}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });
      const latency = Date.now() - start;
      if (res.ok) {
        checks.worker = { status: "ok", latency, detail: "railway worker healthy" };
      } else {
        workerUnreachable = true;
        checks.worker = { status: "unreachable", latency, detail: `HTTP ${res.status}` };
      }
    } catch (e: unknown) {
      workerUnreachable = true;
      checks.worker = {
        status: "unreachable",
        detail: e instanceof Error ? e.message : "timeout or network error",
      };
    }
  } else {
    workerUnreachable = true;
    checks.worker = { status: "unreachable", detail: "WORKER_URL not configured" };
  }

  // Determine overall status
  // Worker unreachable → degraded (background jobs unavailable, but app still serves).
  // Other check errors → degraded at 1 error, unhealthy at 2+.
  const hardErrors = Object.entries(checks)
    .filter(([key, c]) => key !== "worker" && c.status === "error")
    .length;
  const status: HealthStatus["status"] =
    hardErrors >= 2
      ? "unhealthy"
      : hardErrors === 1 || workerUnreachable
        ? "degraded"
        : "ok";

  // Circuit breaker status
  const cbStatus: HealthStatus["circuitBreakers"] = {};
  for (const [name, cb] of Object.entries(circuitBreakers)) {
    const snap = cb.metricsSnapshot;
    cbStatus[name] = {
      state: snap.state,
      failures: snap.failures,
      cooldownMs: 30_000,
    };
  }

  const result: HealthStatus = {
    status,
    checks,
    circuitBreakers: cbStatus,
    uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
    timestamp: Date.now(),
  };

  const responseStatus = status === "ok" || status === "degraded" ? 200 : 503;

  logger.info("Health check", { status, errors: hardErrors, workerUnreachable });

  return NextResponse.json(result, { status: responseStatus });
}

export const dynamic = "force-dynamic";
