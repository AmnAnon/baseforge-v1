// src/app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

// Categories to exclude — not native DeFi protocols
const EXCLUDED = new Set([
  "CEX",                // Binance, MEXC, etc.
  "Chain",              // Base, Ethereum, etc.
  "Bridge",             // Cross-chain bridges (not per-protocol DeFi)
  "Liquidity Manager",  // Aggregators that don't hold native TVL
  "RWA",                // Real-world assets (different risk model)
]);

async function fetchYields() {
  try {
    const res = await fetch("https://yields.llama.fi/pools?chain=Base", { cache: "no-store" });
    if (!res.ok) return {};
    const json = await res.json();
    // Index yields by protocol slug
    const index: Record<string, { apy: number; tvlUsd: number }[]> = {};
    for (const pool of json.data || []) {
      const slug = pool.project || "";
      if (!index[slug]) index[slug] = [];
      index[slug].push({ apy: pool.apy || 0, tvlUsd: pool.tvlUsd || 0 });
    }
    // Average APY per protocol
    const avg: Record<string, number> = {};
    for (const [slug, pools] of Object.entries(index)) {
      avg[slug] = pools.reduce((s, p) => s + p.apy, 0) / pools.length;
    }
    return avg;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const data = await cache.getOrFetch("analytics", CACHE_TTL.TVL_HISTORY, async () => {
      const [protocolsRes, tvlRes] = await Promise.all([
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
        fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { cache: "no-store" }),
      ]);

      if (!protocolsRes.ok || !tvlRes.ok) throw new Error("DefiLlama request failed");

      const protocols = await protocolsRes.json();
      const tvlHistory = await tvlRes.json();
      const yields = await fetchYields();

      // 1. Filter: has Base TVL, not a CEX/Chain/Bridge
      // 2. Sort: highest Base TVL first
      // 3. Take: top 20
      const baseProtos = protocols
        .filter((p: { chainTvls?: Record<string, number>; category?: string }) => {
          const baseTvl = p.chainTvls?.Base || 0;
          if (baseTvl < 100_000) return false;          // Skip trivial TVL
          const cat = (p.category || "").trim();
          if (EXCLUDED.has(cat)) return false;            // Exclude CEX/Chain/Bridge
          return true;
        })
        .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) =>
          (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0)
        )
        .slice(0, 20);

      const totalTvl = baseProtos.reduce(
        (sum: number, p: { chainTvls: Record<string, number> }) => sum + (p.chainTvls.Base || 0),
        0
      );

      const enriched = baseProtos.map((p: {
        name: string; slug?: string; chainTvls: Record<string, number>;
        change_1d?: number; change_7d?: number; category?: string;
      }) => ({
        id: p.slug || p.name.toLowerCase().replace(/ /g, "-"),
        name: p.name,
        tvl: p.chainTvls.Base || 0,
        change_1d: p.change_1d || 0,
        change_7d: p.change_7d || 0,
        category: p.category || "DeFi",
      }));

      // Build per-protocol detail data
      const protocolData: Record<string, {
        tvl: number; tvlChange: number; totalBorrow: number;
        utilization: number; feesAnnualized: number;
        revenueAnnualized: number; tokenPrice: number | null;
      }> = {};

      // Collect actual APYs for avgApy computation
      const apyValues: number[] = [];

      for (const p of enriched) {
        const apy = yields[p.id] || yields[p.name.toLowerCase().replace(/ /g, "-")] || 0;
        if (apy > 0) apyValues.push(apy);
        const tvlChange = p.change_1d ?? 0;
        const totalBorrow = Math.round(p.tvl * 0.35);     // ~35% utilization estimate
        const utilization = p.tvl > 0 ? (totalBorrow / p.tvl) * 100 : 0;
        const feesAnnualized = Math.round(p.tvl * (apy / 100 + 0.01));
        const revenueAnnualized = Math.round(p.tvl * 0.015);

        protocolData[p.id] = {
          tvl: p.tvl,
          tvlChange,
          totalBorrow,
          utilization: Math.round(utilization * 10) / 10,
          feesAnnualized,
          revenueAnnualized,
          tokenPrice: null,
        };
      }

      const avgApy = apyValues.length > 0
        ? apyValues.reduce((s, a) => s + a, 0) / apyValues.length
        : 0;

      return {
        baseMetrics: {
          totalTvl,
          totalProtocols: enriched.length,
          avgApy: Math.round(avgApy * 100) / 100,
          change24h: enriched.length > 0
            ? enriched.reduce((s: number, p: { change_1d?: number }) => s + (p.change_1d || 0), 0) / enriched.length
            : 0,
        },
        tvlHistory: tvlHistory.slice(-90).map((d: { date: number; tvl: number }) => ({
          date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          tvl: d.tvl,
        })),
        protocols: enriched,
        protocolData,
        timestamp: Date.now(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json({ error: "Analytics fetch failed" }, { status: 500 });
  }
}
