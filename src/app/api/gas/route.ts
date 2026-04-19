// src/app/api/gas/route.ts
// Base L2 gas tracker — Basescan gas oracle primary, viem getGasPrice() fallback.
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface GasData {
  safe: number;         // Gwei
  standard: number;     // Gwei
  fast: number;         // Gwei
  baseFee: number;      // Gwei
  source: string;
  congestion: "low" | "medium" | "high";
  timestamp: number;
}

const FALLBACK_GAS: GasData = {
  safe: 0.001, standard: 0.002, fast: 0.005,
  baseFee: 0.001, source: "default", congestion: "low", timestamp: 0,
};

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch<GasData>("gas-data", CACHE_TTL.PRICES, async () => {
      const apiKey = process.env.ETHERSCAN_API_KEY;

      // Primary: Basescan gas oracle (chainid=8453)
      if (apiKey) {
        try {
          const res = await fetch(
            `https://api.etherscan.io/v2/api?chainid=8453&module=gastracker&action=gasoracle&apikey=${apiKey}`,
            { cache: "no-store", signal: AbortSignal.timeout(6_000) }
          );
          if (res.ok) {
            const json = await res.json();
            if (json.status === "1" && json.result) {
              const r = json.result;
              const safe = parseFloat(r.SafeGasPrice) || 0.001;
              const standard = parseFloat(r.ProposeGasPrice) || 0.002;
              const fast = parseFloat(r.FastGasPrice) || 0.005;
              const baseFee = parseFloat(r.suggestBaseFee) || safe;
              let congestion: "low" | "medium" | "high" = "low";
              if (fast > 0.01) congestion = "high";
              else if (fast > 0.003) congestion = "medium";
              return { safe, standard, fast, baseFee, source: "basescan-oracle", congestion, timestamp: Date.now() };
            }
          }
        } catch {
          // fall through to viem
        }
      }

      // Fallback: viem getGasPrice via Base public RPC
      try {
        const { createPublicClient, http } = await import("viem");
        const { base } = await import("viem/chains");
        const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
        const gasPrice = await client.getGasPrice();
        const gasPriceGwei = Number(gasPrice) / 1e9;
        let congestion: "low" | "medium" | "high" = "low";
        if (gasPriceGwei > 0.01) congestion = "high";
        else if (gasPriceGwei > 0.002) congestion = "medium";
        return {
          safe: gasPriceGwei,
          standard: gasPriceGwei * 1.2,
          fast: gasPriceGwei * 1.5,
          baseFee: gasPriceGwei,
          source: "viem-rpc",
          congestion,
          timestamp: Date.now(),
        };
      } catch {
        return { ...FALLBACK_GAS, timestamp: Date.now() };
      }
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("Gas API error:", err);
    return NextResponse.json({ ...FALLBACK_GAS, timestamp: Date.now() }, { status: 200 });
  }
}
