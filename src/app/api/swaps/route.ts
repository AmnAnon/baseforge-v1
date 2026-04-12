// src/app/api/swaps/route.ts
// Large swap events from Aerodrome + Uniswap V3 on Base.
// Primary: Envio HyperSync | Fallback: Etherscan V2

import { NextResponse } from "next/server";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { getLargeSwaps } from "@/lib/data/indexers";

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const protocol = url.searchParams.get("protocol") as "aerodrome" | "uniswap-v3" | "uniswap-v4" | null;
    const minUSD = parseInt(url.searchParams.get("min") || "1000");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    const result = await getLargeSwaps({
      protocol: protocol || undefined,
      minAmountUSD: Number.isFinite(minUSD) ? minUSD : 1000,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json(
      {
        swaps: result.swaps,
        total: result.swaps.length,
        source: result.source,
        timestamp: result.timestamp,
        isStale: false,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          "X-Data-Source": result.source,
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        swaps: [],
        total: 0,
        source: "none",
        timestamp: Date.now(),
        isStale: true,
        error: "Failed to fetch swap data",
      },
      { status: 200 }
    );
  }
}

export const dynamic = "force-dynamic";
