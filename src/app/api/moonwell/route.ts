// src/app/api/moonwell/route.ts
// Moonwell lending markets — Ponder GraphQL primary, DefiLlama yields fallback.

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface MoonwellMarket {
  underlyingSymbol: string;
  supplyApy: number;
  borrowApy: number;
  totalSupplyUsd: number;
  totalBorrowsUsd: number;
}

const PONDER_QUERY = `
  {
    markets {
      underlyingSymbol
      supplyApy
      borrowApy
      totalSupplyUsd
      totalBorrowsUsd
    }
  }
`;

async function fetchPonderMarkets(): Promise<MoonwellMarket[] | null> {
  try {
    const res = await fetch("https://ponder.moonwell.fi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: PONDER_QUERY }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const markets: MoonwellMarket[] = json?.data?.markets;
    if (!Array.isArray(markets) || markets.length === 0) return null;
    return markets;
  } catch {
    return null;
  }
}

// DefiLlama yields fallback — filter for Moonwell pools on Base
async function fetchLlamaYields(): Promise<MoonwellMarket[] | null> {
  try {
    const res = await fetch("https://yields.llama.fi/pools?chain=Base&project=moonwell", {
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pools: Array<{
      symbol: string;
      apy: number;
      apyBorrow?: number;
      tvlUsd: number;
      totalBorrowUsd?: number;
    }> = json?.data || [];
    if (pools.length === 0) return null;
    return pools.map((p) => ({
      underlyingSymbol: p.symbol.replace(/^m/, "").split("-")[0],
      supplyApy: Math.round((p.apy || 0) * 100) / 100,
      borrowApy: Math.round((p.apyBorrow || 0) * 100) / 100,
      totalSupplyUsd: Math.round(p.tvlUsd || 0),
      totalBorrowsUsd: Math.round(p.totalBorrowUsd || 0),
    }));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("moonwell-markets", CACHE_TTL.YIELDS, async () => {
      // Primary: Ponder GraphQL
      const ponder = await fetchPonderMarkets();
      if (ponder) {
        const totalSupply = ponder.reduce((s, m) => s + m.totalSupplyUsd, 0);
        const totalBorrows = ponder.reduce((s, m) => s + m.totalBorrowsUsd, 0);
        return {
          markets: ponder,
          summary: {
            totalSupplyUsd: Math.round(totalSupply),
            totalBorrowsUsd: Math.round(totalBorrows),
            utilizationRate: totalSupply > 0 ? Math.round((totalBorrows / totalSupply) * 10000) / 100 : 0,
            marketCount: ponder.length,
          },
          source: "ponder-graphql",
          timestamp: Date.now(),
          isStale: false,
        };
      }

      // Fallback: DefiLlama yields
      const llama = await fetchLlamaYields();
      if (llama) {
        const totalSupply = llama.reduce((s, m) => s + m.totalSupplyUsd, 0);
        const totalBorrows = llama.reduce((s, m) => s + m.totalBorrowsUsd, 0);
        return {
          markets: llama,
          summary: {
            totalSupplyUsd: Math.round(totalSupply),
            totalBorrowsUsd: Math.round(totalBorrows),
            utilizationRate: totalSupply > 0 ? Math.round((totalBorrows / totalSupply) * 10000) / 100 : 0,
            marketCount: llama.length,
          },
          source: "defillama-yields",
          timestamp: Date.now(),
          isStale: false,
        };
      }

      throw new Error("All Moonwell data sources failed");
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "X-Data-Source": data.source,
      },
    });
  } catch (err) {
    logger.error("Moonwell API error", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      {
        markets: [],
        summary: { totalSupplyUsd: 0, totalBorrowsUsd: 0, utilizationRate: 0, marketCount: 0 },
        source: "none",
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200 }
    );
  }
}

export const revalidate = 300;
