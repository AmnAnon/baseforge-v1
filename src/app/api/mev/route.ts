// src/app/api/mev/route.ts
// MEV activity — Dune Analytics primary (query 3390728), indexer heuristics fallback.

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

// ─── Dune Analytics fetch ───────────────────────────────────────

async function fetchDuneMEV(): Promise<{ events: MEVEvent[]; source: string } | null> {
  const apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      "https://api.dune.com/api/v1/query/3390728/results?limit=50",
      {
        headers: { "x-dune-api-key": apiKey },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const rows: Array<Record<string, unknown>> = json?.result?.rows || [];
    if (rows.length === 0) return null;

    const events: MEVEvent[] = rows.map((row) => ({
      txHash: String(row.tx_hash || row.txHash || ""),
      type: (row.mev_type === "arbitrage"
        ? "likely_arbitrage"
        : row.mev_type === "sandwich"
        ? "possible_sandwich"
        : "large_swap") as MEVEvent["type"],
      protocol: String(row.protocol || row.dex || "unknown"),
      amountUSD: Number(row.profit_usd ?? row.amount_usd ?? 0),
      sender: String(row.searcher_address || row.sender || "").slice(0, 10),
      timestamp: row.block_time
        ? Math.floor(new Date(String(row.block_time)).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      blockNumber: Number(row.block_number || 0),
    }));

    return { events, source: "dune-analytics" };
  } catch {
    return null;
  }
}

// ─── Demo fallback ──────────────────────────────────────────────

function getDemoMEV(): { events: MEVEvent[]; demo: boolean; source: string } {
  const now = Math.floor(Date.now() / 1000);
  return {
    demo: true,
    source: "demo",
    events: [
      { txHash: "0xdemo1", type: "likely_arbitrage", protocol: "Aerodrome", amountUSD: 142000, sender: "0xarb1...", timestamp: now - 120, blockNumber: 99999 },
      { txHash: "0xdemo2", type: "possible_sandwich", protocol: "Uniswap V3", amountUSD: 87000, sender: "0xsand...", timestamp: now - 300, blockNumber: 99998 },
      { txHash: "0xdemo3", type: "large_swap", protocol: "Aerodrome", amountUSD: 305000, sender: "0xwhal...", timestamp: now - 600, blockNumber: 99990 },
    ],
  };
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("mev-v3", CACHE_TTL.WHALE_TX, async () => {
      // Primary: Dune Analytics
      const duneResult = await fetchDuneMEV();
      if (duneResult) {
        const arb = duneResult.events.filter((e) => e.type === "likely_arbitrage").length;
        const sandwich = duneResult.events.filter((e) => e.type === "possible_sandwich").length;
        const extracted = duneResult.events
          .filter((e) => e.type !== "large_swap")
          .reduce((s, e) => s + e.amountUSD, 0);
        return {
          events: duneResult.events.slice(0, 30),
          stats: {
            total24h: duneResult.events.length,
            arbitrageCount: arb,
            sandwichCount: sandwich,
            largeSwapCount: duneResult.events.filter((e) => e.type === "large_swap").length,
            estimatedExtractedUSD: Math.round(extracted),
            avgSwapSize: duneResult.events.length > 0
              ? Math.round(duneResult.events.reduce((s, e) => s + e.amountUSD, 0) / duneResult.events.length)
              : 0,
          },
          source: duneResult.source,
          demo: false,
          dataNote: "Live MEV data from Dune Analytics.",
          timestamp: Date.now(),
          isStale: false,
        };
      }

      // Secondary: indexer heuristics
      const swapResult = await getLargeSwaps({ minAmountUSD: 50_000, limit: 100 });
      const swaps = swapResult.swaps;

      const events: MEVEvent[] = [];
      const blockGroups = new Map<number, typeof swaps>();
      for (const swap of swaps) {
        if (!blockGroups.has(swap.blockNumber)) blockGroups.set(swap.blockNumber, []);
        blockGroups.get(swap.blockNumber)!.push(swap);
      }
      for (const swap of swaps) {
        const sameBlock = blockGroups.get(swap.blockNumber) || [];
        if (sameBlock.length >= 2 && swap.amountUSD >= 100_000) {
          events.push({ txHash: swap.txHash, type: "likely_arbitrage", protocol: swap.protocol, amountUSD: swap.amountUSD, sender: swap.sender.slice(0, 10), timestamp: swap.timestamp, blockNumber: swap.blockNumber });
        } else if (sameBlock.length >= 3 || swaps.some((s) => s.txHash !== swap.txHash && Math.abs(s.blockNumber - swap.blockNumber) <= 1 && s.sender === swap.sender)) {
          events.push({ txHash: swap.txHash, type: "possible_sandwich", protocol: swap.protocol, amountUSD: swap.amountUSD, sender: swap.sender.slice(0, 10), timestamp: swap.timestamp, blockNumber: swap.blockNumber });
        } else if (swap.amountUSD >= 50_000) {
          events.push({ txHash: swap.txHash, type: "large_swap", protocol: swap.protocol, amountUSD: swap.amountUSD, sender: swap.sender.slice(0, 10), timestamp: swap.timestamp, blockNumber: swap.blockNumber });
        }
      }
      const unique = Array.from(new Map(events.map((e) => [e.txHash, e])).values()).sort((a, b) => b.amountUSD - a.amountUSD);
      const arbCount = unique.filter((e) => e.type === "likely_arbitrage").length;
      const sandwichCount = unique.filter((e) => e.type === "possible_sandwich").length;
      const totalExtracted = unique.filter((e) => e.type !== "large_swap").reduce((s, e) => s + e.amountUSD * 0.003, 0);

      return {
        events: unique.slice(0, 30),
        stats: {
          total24h: unique.length,
          arbitrageCount: arbCount,
          sandwichCount: sandwichCount,
          largeSwapCount: unique.filter((e) => e.type === "large_swap").length,
          estimatedExtractedUSD: Math.round(totalExtracted),
          avgSwapSize: unique.length > 0 ? Math.round(unique.reduce((s, e) => s + e.amountUSD, 0) / unique.length) : 0,
        },
        source: swapResult.source,
        demo: false,
        dataNote: "MEV classification uses heuristics. Set DUNE_API_KEY for labeled data.",
        timestamp: Date.now(),
        isStale: false,
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120", "X-Data-Source": data.source || "indexer" },
    });
  } catch (err) {
    logger.error("MEV API error", { error: err instanceof Error ? err.message : "unknown" });
    const demo = getDemoMEV();
    return NextResponse.json(
      {
        ...demo,
        stats: { total24h: demo.events.length, arbitrageCount: 1, sandwichCount: 1, largeSwapCount: 1, estimatedExtractedUSD: 690, avgSwapSize: 178000 },
        dataNote: "Live data unavailable. Add DUNE_API_KEY for real MEV data.",
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200 }
    );
  }
}
