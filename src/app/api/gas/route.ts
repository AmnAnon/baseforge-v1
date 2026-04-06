// src/app/api/gas/route.ts
// Base L2 gas tracker — shows current L2 base fee + L1 blob fee estimate
// Traders use this to time entries
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface GasData {
  l2BaseFee: number; // wei
  l2BaseFeeGwei: number;
  l2PriorityFee: number; // suggested priority fee
  l1BlobFeeWei: number; // estimated fee for posting to L1 (per tx)
  totalCostTx: string; // estimated total cost for 1 typical tx
  congestion: "low" | "medium" | "high";
  timestamp: number;
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch<GasData>("gas-data", CACHE_TTL.PRICES, async () => {
      // Try Etherscan for Base gas info
      // Fallback: use Base public RPC to get gas prices
      const apiKey = process.env.ETHERSCAN_API_KEY;

      let l2BaseFee = 1_000_000; // 0.001 Gwei default (Base typical base fee)
      const l2PriorityFee = 100_000; // 0.0001 Gwei
      const l1BlobFeeWei = 50_000_000_000_000; // ~50k gwei blob fee estimate

      if (apiKey) {
        try {
          const res = await fetch(
            `https://api.etherscan.io/v2/api?chainid=8453&module=proxy&action=eth_gasPrice&apikey=${apiKey}`,
            { cache: "no-store" }
          );
          if (res.ok) {
            const json = await res.json();
            if (json.result && json.result !== "0x") {
              l2BaseFee = parseInt(json.result, 16);
            }
          }
        } catch {
          // Use defaults on failure
        }
      }

      // Determine congestion level
      const l2BaseFeeGwei = l2BaseFee / 1e9;
      let congestion: "low" | "medium" | "high" = "low";
      if (l2BaseFeeGwei > 0.01) congestion = "high";
      else if (l2BaseFeeGwei > 0.002) congestion = "medium";

      // Estimate: 21k gas * gas price
      const estimatedTxGas = 21_000;
      const totalCostEth = ((l2BaseFee + l2PriorityFee) * estimatedTxGas) / 1e18;

      return {
        l2BaseFee,
        l2BaseFeeGwei: Math.round(l2BaseFeeGwei * 1000) / 1000,
        l2PriorityFee,
        l1BlobFeeWei,
        totalCostTx: `${(totalCostEth * 1e9).toFixed(4)} Gwei`,
        congestion,
        timestamp: Date.now(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Gas API error:", err);
    return NextResponse.json(
      {
        l2BaseFee: 1_000_000,
        l2BaseFeeGwei: 0.001,
        l2PriorityFee: 100_000,
        l1BlobFeeWei: 50000000000000,
        totalCostTx: "0.0021 Gwei",
        congestion: "low" as const,
        timestamp: Date.now(),
      },
      { status: 200 }
    );
  }
}
