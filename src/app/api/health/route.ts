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
  try {
    return await runHealthChecks();
  } catch (e: unknown) {
    logger.error("Health endpoint crashed", { error: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json(
      { status: "degraded", checks: { system: { status: "error", detail: "health check crashed" } }, timestamp: Date.now() },
      { status: 200 }
    );
  }
}

async function runHealthChecks() {
  const checks: HealthStatus["checks"] = {};

  // ─── Parallel I/O: upstream APIs + DB + indexer + worker ───────
  // All independent — run concurrently with individual timeouts so one
  // slow upstream can't block the entire health response.

  const cacheStats = cache.stats();
  const cacheBackend = process.env.CACHE_BACKEND || "memory";
  const isProd = process.env.NODE_ENV === "production";

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");

  const [llamaCheck, coingeckoCheck, dbResult, indexerResult, workerResult] =
    await Promise.all([
      checkUpstream("https://api.llama.fi/healthy", "DefiLlama"),
      checkUpstream(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        "CoinGecko"
      ),
      process.env.DATABASE_URL
        ? checkDatabase()
        : Promise.resolve(null),
      getIndexerHealth().catch(() => null),
      workerUrl
        ? fetch(`${workerUrl}/health`, {
            cache: "no-store",
            signal: AbortSignal.timeout(2_000),
          })
            .then((res) => ({ ok: res.ok, status: res.status, latency: 0 }))
            .catch((e: unknown) => ({ ok: false, status: 0, error: e instanceof Error ? e.message : "timeout or network error" }))
        : Promise.resolve(null),
    ]);

  checks.defillama = llamaCheck;
  checks.coingecko = coingeckoCheck;

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

  if (dbResult !== null) {
    checks.database = dbResult;
  }

  if (indexerResult !== null) {
    checks.indexer_primary = {
      status: indexerResult.primary.healthy ? "ok" : "error",
      latency: indexerResult.primary.latencyMs,
      detail: `${indexerResult.primary.provider} block=${indexerResult.primary.lastBlock} lag=${indexerResult.primary.lag}`,
    };
    checks.indexer_fallback = {
      status: indexerResult.fallback.healthy ? "ok" : "error",
      latency: indexerResult.fallback.latencyMs,
      detail: `${indexerResult.fallback.provider} block=${indexerResult.fallback.lastBlock}`,
    };
    checks.indexer_active = {
      status: "ok",
      detail: `active_provider=${indexerResult.activeProvider}`,
    };
  } else {
    checks.indexer = { status: "error", detail: "Health check failed" };
  }

  // Worker status
  let workerUnreachable = false;
  if (workerResult === null) {
    workerUnreachable = true;
    checks.worker = { status: "unreachable", detail: "WORKER_URL not configured" };
  } else if (!workerResult.ok) {
    workerUnreachable = true;
    checks.worker = {
      status: "unreachable",
      detail: "error" in workerResult ? workerResult.error : `HTTP ${workerResult.status}`,
    };
  } else {
    checks.worker = { status: "ok", detail: "railway worker healthy" };
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
