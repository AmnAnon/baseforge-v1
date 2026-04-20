// src/app/api/risk-history/route.ts
// Historical risk scores for individual protocols.
//
// Primary:  query risk_snapshots table (populated by the worker every 5 min)
// Fallback: reconstruct from DefiLlama TVL history (original behaviour)
//
// Response:
//   { history: RiskHistoryPoint[], protocol: string, source: string }

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { riskSnapshots } from "@/lib/db/schema";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface RiskHistoryPoint {
  date: string;        // ISO string for charts
  healthScore: number;
  tvl: number;
  timestamp: number;   // unix ms — for time-series axis
}

// ─── DB query ─────────────────────────────────────────────────────

async function queryRiskSnapshots(protocol: string): Promise<RiskHistoryPoint[]> {
  const rows = await db
    .select({
      score:     riskSnapshots.score,
      health:    riskSnapshots.health,
      tvl:       riskSnapshots.tvl,
      timestamp: riskSnapshots.timestamp,
    })
    .from(riskSnapshots)
    .where(eq(riskSnapshots.protocol, protocol))
    .orderBy(desc(riskSnapshots.timestamp))
    .limit(168); // 7 days of ~hourly snapshots (worker runs every 5 min, deduped in practice)

  return rows.map((r) => {
    const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : new Date(r.timestamp).getTime();
    return {
      date:        new Date(ts).toISOString(),
      healthScore: r.health ?? r.score,
      tvl:         parseFloat(String(r.tvl ?? 0)),
      timestamp:   ts,
    };
  }).reverse(); // chronological order for charts
}

// ─── DefiLlama fallback ───────────────────────────────────────────

async function queryDefiLlamaFallback(protocol: string): Promise<RiskHistoryPoint[]> {
  const res = await fetch(`https://api.llama.fi/protocol/${protocol}`, { cache: "no-store" });
  if (!res.ok) return [];

  const protocolData = await res.json();
  const baseHistory: Array<{ date: number; tvl: number }> =
    protocolData?.chainTvls?.Base?.tvl ?? protocolData?.tvl ?? [];

  if (baseHistory.length === 0) return [];

  const auditCount = protocolData.audits ?? 0;

  return baseHistory
    .filter((_, i) => i % 7 === 0) // weekly samples
    .slice(-52)
    .map((point, i, arr) => {
      const tvl = point.tvl ?? 0;
      const windowStart = Math.max(0, i - 7);
      const window = arr.slice(windowStart, i + 1).map((p) => p.tvl);
      const maxTvl = Math.max(...window);
      const minTvl = Math.min(...window);
      const volatility = maxTvl > 0 ? (maxTvl - minTvl) / maxTvl : 0;

      let score = 50 + auditCount * 5;
      if (tvl > 100_000_000) score += 15;
      else if (tvl > 10_000_000) score += 10;
      else if (tvl > 1_000_000) score += 5;
      if (volatility > 0.3) score -= 20;
      else if (volatility > 0.15) score -= 10;
      score = Math.max(0, Math.min(100, score));

      const ts = point.date * 1000;
      return {
        date:        new Date(ts).toISOString(),
        healthScore: Math.round(score),
        tvl,
        timestamp:   ts,
      };
    });
}

// ─── Route handler ────────────────────────────────────────────────

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url      = new URL(req.url);
    const protocol = url.searchParams.get("protocol");

    if (!protocol) {
      return NextResponse.json({ error: "Missing protocol parameter" }, { status: 400 });
    }

    const cacheKey = `risk-history-v2-${protocol.toLowerCase()}`;
    const data = await cache.getOrFetch(cacheKey, CACHE_TTL.PROTOCOL_LIST, async () => {
      // Primary: DB snapshots
      if (process.env.DATABASE_URL) {
        try {
          const snapshots = await queryRiskSnapshots(protocol);
          if (snapshots.length > 0) {
            return {
              history:  snapshots,
              protocol,
              source:   "db",
              _points:  snapshots.length,
            };
          }
        } catch (err) {
          console.warn("[risk-history] DB query failed, falling back to DefiLlama:", err);
        }
      }

      // Fallback: DefiLlama TVL history
      const history = await queryDefiLlamaFallback(protocol);
      return {
        history,
        protocol,
        source:  "defillama-fallback",
        _points: history.length,
      };
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "X-Data-Source": (data as { source?: string }).source ?? "unknown",
      },
    });
  } catch (err) {
    console.error("Risk history API error:", err);
    return NextResponse.json({ error: "Risk history fetch failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
