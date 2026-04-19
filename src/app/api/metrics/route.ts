// src/app/api/metrics/route.ts
// Prometheus-compatible metrics endpoint.
//
// Primary path: proxy from the Railway worker (WORKER_URL/metrics).
// The worker maintains a persistent prom-client registry that survives
// across requests — no cold-start resets.
//
// Fallback path: if WORKER_URL is unset or the worker times out, serve
// the local Next.js metrics with a notice comment so scrapers can detect
// the degraded state.

import { cache } from "@/lib/cache";
import { circuitBreakers } from "@/lib/circuit-breaker";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { count } from "drizzle-orm";

const START_TIME = Date.now();

// ─── Local fallback registry ──────────────────────────────────────
// Mirrors the original implementation; only used when worker is unreachable.

function escapeMetricName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

async function buildLocalMetrics(): Promise<string> {
  const lines: string[] = [
    "# NOTICE worker_unreachable=true local_metrics_only=true",
  ];

  function metric(
    name: string,
    value: number | string,
    help?: string,
    labels?: Record<string, string>,
  ) {
    const full = `baseforge_${escapeMetricName(name)}`;
    if (help) lines.push(`# HELP ${full} ${help}`);
    if (typeof value === "number") lines.push(`# TYPE ${full} gauge`);
    const labelStr = labels
      ? `{${Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",")}}`
      : "";
    lines.push(`${full}${labelStr} ${value}`);
  }

  // Uptime
  metric(
    "uptime_seconds",
    Math.round((Date.now() - START_TIME) / 1000),
    "Process uptime in seconds",
  );

  // Cache
  const cacheStats = cache.stats();
  metric("cache_size", cacheStats.size, "Number of entries in cache");
  metric("cache_hit_rate", cacheStats.hitRate, "Cache hit rate (0-1)");

  // Circuit breakers
  for (const [name, cb] of Object.entries(circuitBreakers)) {
    const stateMap: Record<string, number> = {
      closed: 0,
      open: 1,
      "half-open": 2,
    };
    metric(
      "circuit_breakers",
      stateMap[cb.state] ?? 0,
      "Circuit breaker state",
      { circuit: name, state: cb.state },
    );
    metric(
      "circuit_breaker_failures",
      cb.metricsSnapshot.failures,
      "Consecutive failures",
      { circuit: name },
    );
  }

  // API key count
  try {
    const [result] = await db.select({ count: count() }).from(apiKeys);
    metric("api_keys_total", result.count, "Total API keys in database");
  } catch {
    metric(
      "api_keys_total",
      -1,
      "Total API keys in database (unavailable)",
    );
  }

  metric("version_info", 1, "Schema version marker", { version: "1.0.0" });

  return lines.join("\n") + "\n";
}

// ─── Route ────────────────────────────────────────────────────────

export async function GET() {
  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");

  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/metrics`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });
      if (res.ok) {
        // Proxy the worker response verbatim — preserve Content-Type.
        const body = await res.text();
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type":
              res.headers.get("Content-Type") ??
              "text/plain; version=0.0.4; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      // Worker responded but with a non-OK status — fall through to local.
    } catch {
      // Timeout or network error — fall through to local.
    }
  }

  // Fallback: local metrics with notice header
  const body = await buildLocalMetrics();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
