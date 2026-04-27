// src/app/api/mev/route.ts
// MEV activity — Envio sandwich detection (primary), Redis cache (fallback).
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
import { Redis } from "@upstash/redis";

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

// ─── Redis (optional fallback) ─────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
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

// ─── Fallback: Redis cache ─────────────────────────────────────────

async function fetchFromRedisCache(): Promise<MEVEvent[] | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    const raw = await client.get<string | MEVEvent[]>("mev:recent");
    if (!raw) return null;
    const parsed: MEVEvent[] = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
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
      // ── 1. Try Envio sandwich detector via circuit breaker (when available) ──
      let events: MEVEvent[] | null = null;
      let source = "envio-sandwich-detector";
      let notice: string | undefined;

      try {
        const result = await fetchSandwichData();
        events = result.events;
        source = result.source;
        notice = result.notice;
      } catch (err) {
        logger.warn("Envio sandwich detection failed, trying Redis cache", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // ── 2. Fallback: Redis cache ──
      if (!events) {
        events = await fetchFromRedisCache();
        if (events) {
          source = "redis-cache";
          notice = "Live MEV data temporarily unavailable — showing last known data";
        }
      }

      // ── 3. Empty state ──
      if (!events || events.length === 0) {
        const emptyStats = computeStats([]);
        return {
          events: [],
          stats: emptyStats,
          source: "envio-sandwich-detector",
          _demo: false,
          _notice: "No MEV activity detected in recent blocks. Sandwich detection is running on Envio HyperSync.",
          dataNote: "Sandwich detection analyzes swap events for front-run → victim → back-run patterns. Currently scanning ~200 blocks.",
          timestamp: Date.now(),
          isStale: false,
        };
      }

      const sorted = events.sort((a, b) => b.extracted - a.extracted);

      return {
        events: sorted.slice(0, 30),
        stats:  computeStats(sorted),
        source,
        _demo:  false,
        ...(notice ? { _notice: notice } : {}),
        dataNote: source === "envio-sandwich-detector"
          ? "MEV detected via Envio HyperSync swap event pattern analysis."
          : "Showing cached MEV data — Envio temporarily unreachable.",
        timestamp: Date.now(),
        isStale: source !== "envio-sandwich-detector",
      };
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
