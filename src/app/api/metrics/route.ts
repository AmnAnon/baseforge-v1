// src/app/api/metrics/route.ts
// Prometheus-compatible metrics endpoint.
// Exposes application metrics in text format for scraping.
//
// Endpoint: GET /api/metrics
// Format: OpenMetrics / Prometheus text exposition
//
// Metrics:
//   baseforge_uptime_seconds          — Process uptime
//   baseforge_cache_size            — Current cache entry count
//   baseforge_cache_hit_rate        — Cache hit rate (0-1)
//   baseforge_protocols_total       — Number of tracked protocols
//   baseforge_circuit_breakers      — Circuit breaker states (0=closed, 1=open, 2=half-open)
//   baseforge_db_api_keys_total     — Total API keys in database

import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { circuitBreakers } from "@/lib/circuit-breaker";
import { db } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

const START_TIME = Date.now();

function escapeMetricName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

export async function GET() {
  const lines: string[] = [];

  function metric(name: string, value: number | string, help?: string, labels?: Record<string, string>) {
    if (help) lines.push(`# HELP baseforge_${escapeMetricName(name)} ${help}`);
    if (typeof value === "number") {
      lines.push(`# TYPE baseforge_${escapeMetricName(name)} gauge`);
    }
    const labelStr = labels
      ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
      : "";
    lines.push(`baseforge_${escapeMetricName(name)}${labelStr} ${value}`);
  }

  // Uptime
  const uptimeSeconds = Math.round((Date.now() - START_TIME) / 1000);
  metric("uptime_seconds", uptimeSeconds, "Process uptime in seconds");

  // Cache
  const cacheStats = cache.stats();
  metric("cache_size", cacheStats.size, "Number of entries in cache");
  metric("cache_hit_rate", cacheStats.hitRate, "Cache hit rate (0-1)");

  // Circuit breakers
  for (const [name, cb] of Object.entries(circuitBreakers)) {
    const stateMap: Record<string, number> = { closed: 0, open: 1, "half-open": 2 };
    metric("circuit_breakers", stateMap[cb.state] ?? 0, "Circuit breaker state", {
      circuit: name,
      state: cb.state,
    });
    metric("circuit_breaker_failures", cb.metricsSnapshot.failures, "Consecutive failures", { circuit: name });
  }

  // API key count
  try {
    const [result] = await db.select({ count: count() }).from(apiKeys);
    metric("api_keys_total", result.count, "Total API keys in database");
  } catch {
    metric("api_keys_total", -1, "Total API keys in database (unavailable)");
  }

  // Schema version
  metric("version_info", 1, "Schema version marker", { version: "1.0.0" });

  return new Response(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
