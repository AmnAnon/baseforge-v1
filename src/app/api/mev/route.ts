// src/app/api/mev/route.ts
// MEV activity — Envio sandwich detection (primary), Postgres cache (fallback).
//
// EigenPhi API was previously the primary source but has been deprecated
// (returns 404 on all endpoints). Replaced with self-hosted sandwich
// detection via Envio HyperSync swap event analysis.
//
// Detection strategy:
//   - Fetch recent swap events (same pipeline as whale tracking)
//   - Group by pool × blockNumber
//   - Find 3-tx chains where same address controls first+third swaps
//     on the same pool in opposite directions (front-run → victim → back-run)

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// ─── Types (frontend-compatible) ─────────────────────────────────

interface MEVEvent {
  txHash: string;
  type: "sandwich" | "arbitrage" | "liquidation";
  protocol: string;
  extracted: number;     // USD profit / extracted value
  attacker: string;
  victim: string | null;
  timestamp: number;     // ms
}

interface MEVStats {
  total: number;
  sandwichCount: number;
  arbitrageCount: number;
  liquidationCount: number;
  totalExtractedUSD: number;
  avgExtractedUSD: number;
}

// ─── Envio sandwich source ────────────────────────────────────────

async function fetchSandwichData(): Promise<{
  events: MEVEvent[];
  source: string;
  notice?: string;
}> {
  const { detectSandwiches } = await import("@/lib/data/mev/sandwich-detector");
  const result = await detectSandwiches(200);

  const events: MEVEvent[] = result.sandwiches.map((s) => ({
    txHash: s.txFrontRun,   // show front-run hash as primary
    type: "sandwich" as const,
    protocol: s.protocol,
    extracted: s.extractedUSD,
    attacker: s.attacker.slice(0, 10) + "…",
    victim: s.victim.slice(0, 10) + "…",
    timestamp: s.timestamp * 1000,
  }));

  return {
    events,
    source: "envio-sandwich-detector",
    ...(events.length === 0
      ? { notice: "No sandwich patterns detected in recent blocks" }
      : {}),
  };
}

// ─── Stats computation ────────────────────────────────────────────

function computeStats(events: MEVEvent[]): MEVStats {
  const sandwich    = events.filter((e) => e.type === "sandwich").length;
  const arbitrage   = events.filter((e) => e.type === "arbitrage").length;
  const liquidation = events.filter((e) => e.type === "liquidation").length;
  const totalExtracted = events.reduce((s, e) => s + e.extracted, 0);
  return {
    total:            events.length,
    sandwichCount:    sandwich,
    arbitrageCount:   arbitrage,
    liquidationCount: liquidation,
    totalExtractedUSD:  Math.round(totalExtracted),
    avgExtractedUSD:    events.length > 0 ? Math.round(totalExtracted / events.length) : 0,
  };
}

// ─── Route handler ────────────────────────────────────────────────

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("mev-sandwich-v1", CACHE_TTL.WHALE_TX, async () => {
      // ── 1. Try Envio sandwich detector ──
      try {
        const result = await fetchSandwichData();
        const events = result.events;
        const source = result.source;
        const notice = result.notice;

        const sorted = events.sort((a, b) => b.extracted - a.extracted);

        return {
          events: sorted.slice(0, 30),
          stats:  computeStats(sorted),
          source,
          _demo:  false,
          ...(notice ? { _notice: notice } : {}),
          dataNote: "MEV detected via Envio HyperSync swap event pattern analysis.",
          timestamp: Date.now(),
          isStale: false,
        };
      } catch (err) {
        logger.error("Envio sandwich detection failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw err; // Let cache handle the stale fallback if configured
      }
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        "X-Data-Source": (data as { source?: string }).source ?? "unknown",
      },
    });
  } catch (err) {
    logger.error("MEV API error", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      {
        events: [],
        stats: computeStats([]),
        source: "none",
        _demo: false,
        _notice: "MEV detection unavailable",
        dataNote: "Sandwich detection temporarily unavailable. Will retry automatically.",
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200, headers: { "X-Cache-Status": "ERROR" } }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 60;
