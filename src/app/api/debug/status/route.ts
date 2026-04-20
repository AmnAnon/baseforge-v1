// src/app/api/debug/status/route.ts
// Global data health endpoint — returns source, confidence, and freshness
// for every data pipeline. Used by the health banner in the UI.
//
// GET /api/debug/status
// Returns: { pipelines: Record<string, PipelineStatus>, overall: "green"|"yellow"|"red" }

import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { circuitBreakers } from "@/lib/circuit-breaker";
import { dataConfidence } from "@/lib/utils";

interface PipelineStatus {
  name: string;
  source: string;
  confidence: "high" | "medium" | "low";
  lastUpdatedAt: number | null;
  ageMs: number | null;
  isStale: boolean;
  circuitBreakerState?: string;
}

async function checkPipeline(
  cacheKey: string,
  name: string,
  sourceField = "_dataSource"
): Promise<PipelineStatus> {
  const cached = await cache.get<Record<string, unknown>>(cacheKey);
  if (!cached) {
    return { name, source: "none", confidence: "low", lastUpdatedAt: null, ageMs: null, isStale: true };
  }
  const ts = typeof cached.timestamp === "number" ? cached.timestamp : null;
  const ageMs = ts ? Date.now() - ts : null;
  const source = String(cached[sourceField] ?? cached._source ?? "unknown");
  const isStale = cached.isStale === true;
  return {
    name,
    source,
    confidence: dataConfidence({ source, ageMs: ageMs ?? Infinity, isStale }),
    lastUpdatedAt: ts,
    ageMs,
    isStale,
  };
}

export async function GET() {
  const [analytics, baseOverview, mev, prices] = await Promise.all([
    checkPipeline("analytics", "Analytics (TVL/Protocols)", "_dataSource"),
    checkPipeline("base-overview-v2", "Base Overview", "_source"),
    checkPipeline("mev-eigenphi-v1", "MEV (EigenPhi)", "_source"),
    checkPipeline("baseforge:prices", "Token Prices (CoinGecko)", "_source"),
  ]);

  const pipelines: Record<string, PipelineStatus> = {
    analytics,
    baseOverview,
    mev,
    prices,
  };

  // Attach circuit breaker states
  for (const [key, cb] of Object.entries(circuitBreakers)) {
    if (pipelines[key]) {
      pipelines[key].circuitBreakerState = cb.state;
    }
  }

  // Derive overall health
  const confidences = Object.values(pipelines).map(p => p.confidence);
  const lowCount = confidences.filter(c => c === "low").length;
  const medCount = confidences.filter(c => c === "medium").length;
  const overall =
    lowCount >= 2 ? "red" :
    lowCount >= 1 || medCount >= 2 ? "yellow" :
    "green";

  return NextResponse.json(
    { pipelines, overall, checkedAt: Date.now() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const dynamic = "force-dynamic";
