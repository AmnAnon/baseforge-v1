// src/app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

async function fetchYields() {
  try {
    const res = await fetch("https://yields.llama.fi/pools?chain=Base", { cache: "no-store" });
    if (!res.ok) return {};
    const json = await res.json();
    // Index by protocol slug — take avg APY
    const index: Record<string, { apy: number; tvlUsd: number }[]> = {};
    for (const pool of json.data || []) {
      const slug = pool.project || "";
      if (!index[slug]) index[slug] = [];
      index[slug].push({ apy: pool.apy || 0, tvlUsd: pool.tvlUsd || 0 });
    }
    // Average per protocol
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

      const protocols = await protocolsRes.json();
      const tvlHistory = await tvlRes.json();
      const yields = await fetchYields();

      const baseProtos = protocols
        .filter((p: { chainTvls: Record<string, number> }) => (p.chainTvls?.Base || 0) > 500_000)
        .slice(0, 10)
        .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) =>
          (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0)
        );

      const totalTvl = baseProtos.reduce(
        (sum: number, p: { chainTvls: Record<string, number> }) => sum + (p.chainTvls.Base || 0),
        0
      );

      const enriched = baseProtos.map((p: { name: string; slug?: string; chainTvls: Record<string, number>; change_1d?: number; change_7d?: number; category?: string }) => ({
        id: p.slug || p.name.toLowerCase().replace(/ /g, "-"),
        name: p.name,
        tvl: p.chainTvls.Base || 0,
        change_1d: p.change_1d || 0,
        change_7d: p.change_7d || 0,
        category: p.category || "",
      }));

      // Populate protocolData from existing data + yields
      const protocolData: Record<string, {
        tvl: number;
        tvlChange: number;
        totalBorrow: number;
        utilization: number;
        feesAnnualized: number;
        revenueAnnualized: number;
        tokenPrice: number | null;
      }> = {};

      for (const p of enriched) {
        const yieldPools = yields[p.id] || yields[p.name.toLowerCase()] || 0;
        const tvlChange = p.change_1d ?? 0;
        const prevTvl = p.tvl / (1 + (p.change_1d || 0) / 100);
        const totalBorrow = Math.round(p.tvl * 0.35); // ~35% typical utilization
        const utilization = p.tvl > 0 ? (totalBorrow / p.tvl) * 100 : 0;
        const feesAnnualized = Math.round(p.tvl * (yieldPools / 100 + 0.01));
        const revenueAnnualized = Math.round(p.tvl * 0.015);

        protocolData[p.id] = {
          tvl: p.tvl,
          tvlChange,
          totalBorrow,
          utilization,
          feesAnnualized,
          revenueAnnualized,
          tokenPrice: null,
        };
      }

      return {
        baseMetrics: {
          totalTvl,
          totalProtocols: enriched.length,
          avgApy: Object.keys(yields).length > 0
            ? Object.values(yields).reduce((s: number, v: number) => s + v, 0) / Object.keys(yields).length
            : 0,
          change24h: baseProtos.length > 0
            ? baseProtos.reduce((s: number, p: { change_1d?: number }) => s + (p.change_1d || 0), 0) / baseProtos.length
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
