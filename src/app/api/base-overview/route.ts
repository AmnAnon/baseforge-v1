// src/app/api/base-overview/route.ts
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

const timeout5s = () => AbortSignal.timeout(5_000);

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: timeout5s() });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("base-overview-v2", CACHE_TTL.TVL_HISTORY, async () => {
      const [tvlHistory, volumeData, feesData, bridgeData] = await Promise.all([
        safeFetch<Array<{ date: number; tvl: number }>>(
          "https://api.llama.fi/v2/historicalChainTvl/Base",
          []
        ),
        safeFetch<{ totalVolume?: number; total24h?: number }>(
          "https://api.llama.fi/overview/dexs/base?dataType=dailyVolume",
          {}
        ),
        safeFetch<{ total24h?: number; total7d?: number }>(
          "https://api.llama.fi/overview/fees/base",
          {}
        ),
        safeFetch<Array<{ date: string; depositUSD: number; withdrawUSD: number }>>(
          "https://bridges.llama.fi/bridgevolume/Base?id=12",
          []
        ),
      ]);

      const currentTvl = tvlHistory.length > 0 ? tvlHistory[tvlHistory.length - 1].tvl : 0;
      const tvl7dAgo = tvlHistory.length >= 8 ? tvlHistory[tvlHistory.length - 8].tvl : currentTvl;
      const tvlChange7d = tvl7dAgo > 0 ? ((currentTvl - tvl7dAgo) / tvl7dAgo) * 100 : 0;

      const recentBridge = bridgeData.slice(-1)[0];
      const bridgeVolume24h = recentBridge
        ? (recentBridge.depositUSD || 0) + (recentBridge.withdrawUSD || 0)
        : 0;

      return {
        totalTvl: currentTvl,
        tvlChange7d: Math.round(tvlChange7d * 100) / 100,
        totalVolume24h: volumeData.totalVolume ?? volumeData.total24h ?? 0,
        totalFees24h: feesData.total24h ?? 0,
        totalFees7d: feesData.total7d ?? 0,
        bridgeVolume24h,
        timestamp: Date.now(),
        isStale: false,
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Failed to fetch Base network overview:", error);
    return NextResponse.json(
      { totalTvl: 0, totalVolume24h: 0, totalFees24h: 0, bridgeVolume24h: 0, timestamp: Date.now(), isStale: true },
      { status: 200 }
    );
  }
}

export const revalidate = 300;
