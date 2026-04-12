// src/app/api/whales/route.ts
// Whale tracker — powered by Envio HyperSync with Etherscan V2 fallback.
// Returns whale-sized flows across Aerodrome, Uniswap V3, and Seamless.

import { NextResponse } from "next/server";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { WhalesResponseSchema } from "@/lib/zod/schemas";
import { getWhaleFlows } from "@/lib/data/indexers";

const EMPTY_WHALES = () => ({
  whales: [],
  summary: { total: 0, largest: 0, avgSize: 0, types: {} },
  timestamp: Date.now(),
  isStale: true,
});

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const minUSDParam = parseInt(url.searchParams.get("min") || "50000");
    const minUSD = Number.isFinite(minUSDParam) && minUSDParam >= 0 ? minUSDParam : 50000;
    const limitParam = parseInt(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

    const result = await getWhaleFlows({ minAmountUSD: minUSD, limit });

    const responseData = {
      whales: result.flows.map((f) => ({
        hash: f.txHash,
        from: f.from,
        to: f.to,
        value: `${f.tokenAmount} ${f.token}`,
        valueUSD: f.amountUSD,
        timestamp: new Date(f.timestamp * 1000).toISOString(),
        type: f.type,
        tokenSymbol: f.token,
        protocol: f.protocol,
        blockNumber: f.blockNumber,
      })),
      summary: {
        total: result.flows.length,
        largest: result.summary.largestFlowUSD,
        avgSize:
          result.flows.length > 0
            ? Math.round(result.summary.totalVolumeUSD / result.flows.length)
            : 0,
        types: result.summary.byType,
      },
      source: result.source,
      timestamp: result.timestamp,
      isStale: false,
    };

    const validated = validateOrFallback(WhalesResponseSchema, responseData, EMPTY_WHALES(), "whales");
    return NextResponse.json(validated, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        "X-Cache-Status": "HIT",
        "X-Data-Source": result.source,
      },
    });
  } catch {
    return NextResponse.json(
      { ...EMPTY_WHALES(), isStale: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, stale-while-revalidate=120",
          "X-Data-Source": "none",
        },
      }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 30;
