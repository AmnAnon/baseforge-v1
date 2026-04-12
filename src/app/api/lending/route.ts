// src/app/api/lending/route.ts
// Lending protocol events — Seamless (Aave V3 fork) on Base.
// Tracks deposits, withdrawals, borrows, repays, and liquidations.

import { NextResponse } from "next/server";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { getLendingActivity } from "@/lib/data/indexers";
import type { LendingEvent } from "@/lib/data/indexers";

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") as LendingEvent["action"] | null;
    const minUSD = parseInt(url.searchParams.get("min") || "0");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    const result = await getLendingActivity({
      action: action || undefined,
      minAmountUSD: Number.isFinite(minUSD) ? minUSD : 0,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json(
      {
        events: result.events,
        total: result.events.length,
        summary: result.summary,
        source: result.source,
        timestamp: result.timestamp,
        isStale: false,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
          "X-Data-Source": result.source,
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        events: [],
        total: 0,
        summary: { totalDepositsUSD: 0, totalBorrowsUSD: 0, totalLiquidationsUSD: 0, netFlowUSD: 0 },
        source: "none",
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200 }
    );
  }
}

export const dynamic = "force-dynamic";
