// src/app/api/revenue/route.ts
// Protocol revenue — real per-protocol fees from DefiLlama's fee API.
// No estimation or TVL-proportional guessing — actual protocol-level fee data.

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { resilientFetch } from "@/lib/api-client";
import { logger } from "@/lib/logger";

const EXCLUDED_CATEGORIES = new Set(["Chain", "CEX", "Bridge", "Risk Curators"]);

const ALLOWED_CATEGORIES = new Set([
  "Dexs", "Lending", "Liquid Staking", "Bridge", "Yield",
  "CDP", "RWA", "Derivatives", "Options", "Perpetuals",
  "Algo-Stables", "Yield Aggregator", "Insurance",
]);

const EMPTY_REVENUE = () => ({
  protocols: [],
  aggregate: { totalFees24h: 0, totalFeesAnnualized: 0, protocolCount: 0, timestamp: Date.now() },
  timestamp: Date.now(),
  isStale: true,
});

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("revenue-v2", CACHE_TTL.PROTOCOL_LIST, async () => {
      const json = await resilientFetch("https://api.llama.fi/overview/fees/base", {
        timeoutMs: 15000,
        retries: 2,
      });
      const rawProtocols: Array<{
        name: string;
        category?: string;
        total24h?: number;
        total7d?: number;
        total30d?: number;
        revenue24h?: number;
        revenue7d?: number;
        revenue30d?: number;
        dailyRevenue?: number;
      }> = json.protocols || [];

      // Get latest total from chart
      const chart: Array<[number, number]> = json.totalDataChart || [];
      const latestTotal = chart.length > 0 ? chart[chart.length - 1][1] : 0;

      const protocols = rawProtocols
        .filter((p) => {
          if (!p.total24h || p.total24h < 100) return false;          // < $100/day is noise
          if (EXCLUDED_CATEGORIES.has(p.category || "")) return false;
          if (!ALLOWED_CATEGORIES.has(p.category || "")) return false; // block non-DeFi
          return true;
        })
        .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
        .slice(0, 30)
        .map((p) => ({
          name: p.name,
          category: p.category || "DeFi",
          fees24h: Math.round(p.total24h || 0),
          fees7d: Math.round(p.total7d || 0),
          feesAnnualized: Math.round((p.total24h || 0) * 365),
          revenue24h: Math.round(p.revenue24h || p.dailyRevenue || 0),
          revenueAnnualized: Math.round((p.revenue24h || p.dailyRevenue || 0) * 365),
        }));

      const totalFees24h = protocols.reduce((s, p) => s + p.fees24h, 0);
      const totalRevenue24h = protocols.reduce((s, p) => s + p.revenue24h, 0);

      return {
        protocols,
        aggregate: {
          totalFees24h,
          totalFeesAnnualized: Math.round(totalFees24h * 365),
          totalRevenue24h,
          protocolCount: protocols.length,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        isStale: false,
      };
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "X-Cache-Status": "HIT",
        "X-Data-Source": "defillama-fees",
      },
    });
  } catch (err) {
    logger.error("Revenue API error", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      { ...EMPTY_REVENUE(), isStale: true },
      { status: 200, headers: { "Cache-Control": "public, max-age=0, stale-while-revalidate=300" } }
    );
  }
}
