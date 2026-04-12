// src/app/api/mev/route.ts
// MEV activity — uses real large swap data from the indexer as MEV proxy.
// Large swaps (>$50K) in rapid succession indicate arbitrage/sandwich patterns.
// Full EigenPhi/Flashbots labeling is planned for v2.

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { getLargeSwaps } from "@/lib/data/indexers";
import { logger } from "@/lib/logger";

interface MEVEvent {
  txHash: string;
  type: "likely_arbitrage" | "large_swap" | "possible_sandwich";
  protocol: string;
  amountUSD: number;
  sender: string;
  timestamp: number;
  blockNumber: number;
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("mev-v2", CACHE_TTL.WHALE_TX, async () => {
      // Pull real large swaps from indexer (Envio → Etherscan fallback)
      const swapResult = await getLargeSwaps({ minAmountUSD: 50_000, limit: 100 });
      const swaps = swapResult.swaps;

      // Classify swaps into MEV-like categories
      const events: MEVEvent[] = [];
      const blockGroups = new Map<number, typeof swaps>();

      for (const swap of swaps) {
        if (!blockGroups.has(swap.blockNumber)) blockGroups.set(swap.blockNumber, []);
        blockGroups.get(swap.blockNumber)!.push(swap);
      }

      for (const swap of swaps) {
        const sameBlock = blockGroups.get(swap.blockNumber) || [];

        // Multiple large swaps in same block → likely arbitrage
        if (sameBlock.length >= 2 && swap.amountUSD >= 100_000) {
          events.push({
            txHash: swap.txHash,
            type: "likely_arbitrage",
            protocol: swap.protocol,
            amountUSD: swap.amountUSD,
            sender: swap.sender.slice(0, 10),
            timestamp: swap.timestamp,
            blockNumber: swap.blockNumber,
          });
        }
        // Adjacent blocks with same sender → possible sandwich
        else if (
          sameBlock.length >= 3 ||
          swaps.some(
            (s) =>
              s.txHash !== swap.txHash &&
              Math.abs(s.blockNumber - swap.blockNumber) <= 1 &&
              s.sender === swap.sender
          )
        ) {
          events.push({
            txHash: swap.txHash,
            type: "possible_sandwich",
            protocol: swap.protocol,
            amountUSD: swap.amountUSD,
            sender: swap.sender.slice(0, 10),
            timestamp: swap.timestamp,
            blockNumber: swap.blockNumber,
          });
        }
        // Large swap, no obvious MEV pattern
        else if (swap.amountUSD >= 50_000) {
          events.push({
            txHash: swap.txHash,
            type: "large_swap",
            protocol: swap.protocol,
            amountUSD: swap.amountUSD,
            sender: swap.sender.slice(0, 10),
            timestamp: swap.timestamp,
            blockNumber: swap.blockNumber,
          });
        }
      }

      // Deduplicate by txHash
      const unique = Array.from(new Map(events.map((e) => [e.txHash, e])).values());
      unique.sort((a, b) => b.amountUSD - a.amountUSD);

      const arbCount = unique.filter((e) => e.type === "likely_arbitrage").length;
      const sandwichCount = unique.filter((e) => e.type === "possible_sandwich").length;
      const totalExtracted = unique
        .filter((e) => e.type === "likely_arbitrage" || e.type === "possible_sandwich")
        .reduce((s, e) => s + e.amountUSD * 0.003, 0); // ~0.3% estimated profit

      return {
        events: unique.slice(0, 30),
        stats: {
          total24h: unique.length,
          arbitrageCount: arbCount,
          sandwichCount: sandwichCount,
          largeSwapCount: unique.filter((e) => e.type === "large_swap").length,
          estimatedExtractedUSD: Math.round(totalExtracted),
          avgSwapSize: unique.length > 0
            ? Math.round(unique.reduce((s, e) => s + e.amountUSD, 0) / unique.length)
            : 0,
        },
        source: swapResult.source,
        dataNote: "MEV classification uses heuristics (multi-swap-per-block, same-sender patterns). Full labeled data via EigenPhi planned.",
        timestamp: Date.now(),
        isStale: false,
      };
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        "X-Data-Source": data.source || "indexer",
      },
    });
  } catch (err) {
    logger.error("MEV API error", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      {
        events: [],
        stats: { total24h: 0, arbitrageCount: 0, sandwichCount: 0, largeSwapCount: 0, estimatedExtractedUSD: 0, avgSwapSize: 0 },
        source: "none",
        dataNote: "MEV data temporarily unavailable.",
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200 }
    );
  }
}
