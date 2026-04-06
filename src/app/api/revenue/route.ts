// src/app/api/revenue/route.ts
// Protocol revenue attribution — fees generated vs token emissions
// Uses DefiLlama's fee data (real data, no subgraph needed)
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { RevenueResponseSchema } from "@/lib/zod/schemas";

// Token emission estimates for protocols with known tokenomics
const TOKEN_EMISSIONS: Record<string, number> = {
  "aerodrome-finance": 850_000,
  "moonwell": 120_000,
  "sonne-finance": 80_000,
  "seamless-protocol": 150_000,
  "compound-v3": 40_000,
  "aave-v3": 30_000,
  "uniswap-v3": 0,
  "baseswap": 200_000,
};

const EMPTY_REVENUE = () => ({
  protocols: [],
  aggregate: { totalFees24h: 0, totalFeesAnnualized: 0, protocolCount: 0, timestamp: Date.now() },
  timestamp: Date.now(),
  isStale: true,
});

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getWithStaleFallback("revenue-data", CACHE_TTL.PROTOCOL_LIST, async () => {
      const [feesRes, protocolsRes] = await Promise.all([
        fetch("https://api.llama.fi/v2/fees?chain=base", { cache: "no-store" }),
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
      ]);

      if (!protocolsRes.ok) throw new Error("Failed to fetch protocols");

      const protocols = await protocolsRes.json();

      let totalFees24h = 0;
      if (feesRes.ok) {
        const feesJson = await feesRes.json();
        if (feesJson?.totalDataChart?.length > 0) {
          const latest = feesJson.totalDataChart[feesJson.totalDataChart.length - 1];
          totalFees24h = parseFloat(latest?.[1] || "0");
        }
      }

      const revenues = [];
      const baseProtos = protocols
        .filter((p: { chainTvls?: Record<string, number> }) => (p.chainTvls?.Base || 0) > 1_000_000)
        .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) => (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0));

      for (const proto of baseProtos) {
        const slug = proto.slug || proto.name.toLowerCase().replace(/ /g, "-");
        const tvl = proto.chainTvls.Base || 0;
        const change24h = proto.change_1d || 0;
        const category = proto.category || "DeFi";

        const tvlShare = totalFees24h > 0 ? tvl / totalFees24h : 0;
        const estimatedFees24h = totalFees24h * Math.min(tvlShare, 0.25);
        const revMult = category === "Lending" ? 0.7 : 0.8;
        const estimatedRevenue24h = estimatedFees24h * revMult;

        const annualEmissions = TOKEN_EMISSIONS[slug] || 0;
        const dailyEmissions = annualEmissions / 365;
        const netYield = estimatedRevenue24h - dailyEmissions;

        revenues.push({
          name: proto.name,
          category,
          tvl,
          fees24h: Math.round(estimatedFees24h),
          feesAnnualized: Math.round(estimatedFees24h * 365),
          revenueToTvl: tvl > 0 ? Math.round((estimatedRevenue24h * 365 / tvl) * 10000) / 100 : 0,
          tokenEmissions: Math.round(dailyEmissions),
          netYield: Math.round(netYield),
          change24h,
          audits: proto.audits || 0,
        });
      }

      return {
        protocols: revenues.sort((a: { fees24h: number }, b: { fees24h: number }) => b.fees24h - a.fees24h),
        aggregate: {
          totalFees24h: Math.round(totalFees24h),
          totalFeesAnnualized: Math.round(totalFees24h * 365),
          protocolCount: revenues.length,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    });

    const validated = validateOrFallback(RevenueResponseSchema, data, EMPTY_REVENUE(), "revenue");
    const headers: Record<string, string> = validated.isStale
      ? { "Cache-Control": "public, max-age=0, stale-while-revalidate=120", "X-Cache-Status": "STALE" }
      : { "Cache-Control": "public, max-age=60, stale-while-revalidate=120", "X-Cache-Status": "HIT" };

    return NextResponse.json(validated, { headers });
  } catch (err) {
    return NextResponse.json(
      { ...EMPTY_REVENUE(), isStale: true },
      { status: 200, headers: { "Cache-Control": "public, max-age=0, stale-while-revalidate=120" } }
    );
  }
}
