// src/app/api/mev/route.ts
// MEV activity — EigenPhi Base MEV (primary), Redis cache (fallback).
//
// EigenPhi endpoint (no API key required for basic access):
//   GET https://api.eigenphi.io/ethereum/v1/mev/txs/latest?chain=base&limit=50
//
// Response shape:
//   { events, stats, source, _demo, _notice?, dataNote, timestamp, isStale }

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { circuitBreakers } from "@/lib/circuit-breaker";
import { logger } from "@/lib/logger";
import { Redis } from "@upstash/redis";

// ─── Types ──────────────────────────────────────────────────────

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

// ─── Redis (optional) ─────────────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── EigenPhi field mapping ───────────────────────────────────────

type EigenPhiMevType = string; // "Sandwich" | "Arbitrage" | "Liquidation" | ...

interface EigenPhiTx {
  tx_hash?: string;
  mevType?: EigenPhiMevType;
  profit_usd?: number;
  timestamp?: number;
  protocol?: string;
  attackerAddress?: string;
  victimAddress?: string;
  // some responses use alternate casings
  txHash?: string;
  mev_type?: string;
  profitUsd?: number;
  attacker_address?: string;
  victim_address?: string;
}

function normalizeType(raw: string | undefined): MEVEvent["type"] {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("sandwich")) return "sandwich";
  if (lower.includes("liquidat")) return "liquidation";
  return "arbitrage"; // default for arb, front-run, etc.
}

function mapEigenPhiTx(tx: EigenPhiTx): MEVEvent {
  const txHash   = tx.tx_hash   ?? tx.txHash   ?? "";
  const mevType  = tx.mevType   ?? tx.mev_type  ?? "";
  const profit   = tx.profit_usd ?? tx.profitUsd ?? 0;
  const ts       = tx.timestamp ?? 0;
  const protocol = tx.protocol  ?? "unknown";
  const attacker = tx.attackerAddress ?? tx.attacker_address ?? "";
  const victim   = tx.victimAddress   ?? tx.victim_address   ?? null;

  return {
    txHash,
    type:      normalizeType(mevType),
    protocol:  protocol || "unknown",
    extracted: typeof profit === "number" ? profit : parseFloat(String(profit)) || 0,
    attacker:  attacker ? attacker.slice(0, 10) + "…" : "unknown",
    victim:    victim ? victim.slice(0, 10) + "…" : null,
    // EigenPhi returns Unix seconds; convert to ms
    timestamp: ts > 1e12 ? ts : ts * 1000,
  };
}

// ─── Primary: EigenPhi ────────────────────────────────────────────

async function fetchEigenPhi(): Promise<MEVEvent[]> {
  const res = await fetch(
    "https://api.eigenphi.io/ethereum/v1/mev/txs/latest?chain=base&limit=50",
    {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error(`EigenPhi HTTP ${res.status}`);

  const json = await res.json();

  // EigenPhi wraps results in a data/txs/list key depending on version
  const rows: EigenPhiTx[] =
    Array.isArray(json)               ? json :
    Array.isArray(json.data)          ? json.data :
    Array.isArray(json.txs)           ? json.txs :
    Array.isArray(json.result)        ? json.result :
    Array.isArray(json.mevTransactions) ? json.mevTransactions :
    [];

  if (rows.length === 0) throw new Error("EigenPhi returned empty result set");

  return rows.map(mapEigenPhiTx);
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
    const data = await cache.getOrFetch("mev-eigenphi-v1", CACHE_TTL.WHALE_TX, async () => {
      // ── 1. Try EigenPhi via circuit breaker ──
      let events: MEVEvent[] | null = null;
      let source = "eigenphi";
      let notice: string | undefined;

      try {
        events = await circuitBreakers.eigenphi.execute(() => fetchEigenPhi());
      } catch (err) {
        logger.warn("EigenPhi fetch failed, trying Redis cache", {
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
        return {
          events: [],
          stats: computeStats([]),
          source: "none",
          _demo: false,
          _notice: "MEV data temporarily unavailable",
          dataNote: "EigenPhi data unavailable. Will retry automatically.",
          timestamp: Date.now(),
          isStale: true,
        };
      }

      const sorted = events.sort((a, b) => b.extracted - a.extracted);

      return {
        events: sorted.slice(0, 30),
        stats:  computeStats(sorted),
        source,
        _demo:  false,
        ...(notice ? { _notice: notice } : {}),
        dataNote: source === "eigenphi"
          ? "Live MEV data from EigenPhi Base indexer."
          : "Showing cached MEV data — EigenPhi temporarily unreachable.",
        timestamp: Date.now(),
        isStale: source !== "eigenphi",
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
        _notice: "MEV data temporarily unavailable",
        dataNote: "EigenPhi data unavailable. Will retry automatically.",
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200, headers: { "X-Cache-Status": "ERROR" } }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 60;
