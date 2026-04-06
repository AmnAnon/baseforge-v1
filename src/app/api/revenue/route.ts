// src/app/api/revenue/route.ts
// Protocol revenue attribution — fees generated vs token emissions
// Uses DefiLlama's fee data (real data, no subgraph needed)
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface ProtocolRevenue {
  name: string;
  category: string;
  tvl: number;
  fees24h: number;
  feesAnnualized: number;
  revenueToTvl: number; // annualized fees as % of TVL — "real yield"
  tokenEmissions: number;
  netYield: number; // fees - emissions (positive = profitable, negative = token printing)
  change24h: number;
  audits: number;
}

// Token emission estimates for protocols with known tokenomics
// These are rough estimates — subgraph would give exact numbers
const TOKEN_EMISSIONS: Record<string, number> = {
  "aerodrome-finance": 850_000, // ~$850k/yr in AERO emissions
  "moonwell": 120_000,
  "sonne-finance": 80_000,
  "seamless-protocol": 150_000,
  "compound-v3": 40_000,
  "aave-v3": 30_000,
  "uniswap-v3": 0,
  "baseswap": 200_000,
};

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("revenue-data", CACHE_TTL.PROTOCOL_LIST, async () => {
      const [feesRes, protocolsRes] = await Promise.all([
        fetch("https://api.llama.fi/v2/fees?chain=base", { cache: "no-store" }),
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
      ]);

      if (!protocolsRes.ok) {
        throw new Error("Failed to fetch protocols");
      }

      const protocols = await protocolsRes.json();
      const protocolMap: Record<string, { name: string; chainTvls?: Record<string, number>; change_1d?: number; audits?: number; category?: string; slug?: string; forkedFrom?: string[] }> = {};
      for (const p of protocols) {
        const slug = (p.name || "").toLowerCase().replace(/ /g, "-");
        protocolMap[slug] = p;
      }

      // Chain-level fee estimate from DefiLlama
      let totalFees24h = 0;
      if (feesRes.ok) {
        const feesJson = await feesRes.json();
        if (feesJson?.totalDataChart?.length > 0) {
          const latest = feesJson.totalDataChart[feesJson.totalDataChart.length - 1];
          totalFees24h = parseFloat(latest?.[1] || "0");
        }
      }

      const revenues: ProtocolRevenue[] = [];

      // Generate per-protocol revenue from protocols data
      // Estimate: protocol's share of total TVL = share of fees
      const baseProtos = protocols
        .filter((p: { chainTvls?: Record<string, number>; change_1d?: number; audits?: number; category?: string; slug?: string; name: string; forkedFrom?: string[] }) => (p.chainTvls?.Base || 0) > 1_000_000)
        .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) => (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0));

      for (const proto of baseProtos) {
        const slug = proto.slug || proto.name.toLowerCase().replace(/ /g, "-");
        const tvl = proto.chainTvls.Base || 0;
        const change24h = proto.change_1d || 0;
        const audits = proto.audits || 0;
        const category = proto.category || "DeFi";

        // Estimate proportional fee share
        // More accurate for high-TVL protocols
        const tvlShare = totalFees24h > 0 ? tvl / totalFees24h : 0;
        const estimatedFees24h = totalFees24h * Math.min(tvlShare, 0.25); // cap at 25% per protocol

        // Revenue = fees that actually go to token holders
        // Lending: ~70% (rest goes to stakers/depositors)
        // DEXes: ~80%
        const revMult = category === "Lending" ? 0.7 : 0.8;
        const estimatedRevenue24h = estimatedFees24h * revMult;

        // Token emissions (annual / 365 = daily)
        const annualEmissions = TOKEN_EMISSIONS[slug] || 0;
        const dailyEmissions = annualEmissions / 365;

        // Net yield = revenue - emissions (negative means the protocol is subsidizing TVL with tokens)
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
          audits,
        });
      }

      return {
        protocols: revenues.sort((a, b) => b.fees24h - a.fees24h),
        aggregate: {
          totalFees24h: Math.round(totalFees24h),
          totalFeesAnnualized: Math.round(totalFees24h * 365),
          protocolCount: revenues.length,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Revenue API error:", err);
    return NextResponse.json({ error: "Revenue data unavailable" }, { status: 500 });
  }
}
