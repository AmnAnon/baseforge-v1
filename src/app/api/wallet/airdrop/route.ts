// src/app/api/wallet/airdrop/route.ts
// Wallet Airdrop Eligibility Scoring API for Base Network.

import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateWalletAirdrop } from "@/lib/airdrop";
import { cache } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const AddressSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
});

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const parsed = AddressSchema.safeParse({ address: url.searchParams.get("address") });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Valid Base EVM wallet address is required (0x...)" },
        { status: 400 }
      );
    }

    const { address } = parsed.data;
    const cacheKey = `wallet_airdrop_${address.toLowerCase()}`;

    const data = await cache.getOrFetch(cacheKey, 60, async () => {
      return evaluateWalletAirdrop(address);
    });

    return NextResponse.json(data, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    logger.error("Airdrop scoring endpoint error", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to compute wallet airdrop score" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
    },
  });
}

export const dynamic = "force-dynamic";
