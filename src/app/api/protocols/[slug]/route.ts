// src/app/api/protocols/[slug]/route.ts
// Single protocol detail — TVL, health score, risk factors, yield data

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { z } from "zod";

const protocolTvlItem = z.object({
  date: z.number(),
  tvl: z.number(),
});

const ProtocolDetailResponse = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  category: z.string(),
  chains: z.array(z.string()),
  logo: z.string().optional(),
  tvl: z.number(),
  tvlChange24h: z.number(),
  tvlChange7d: z.number(),
  tvlChange30d: z.number().optional(),
  fees24h: z.number(),
  feesAnnualized: z.number(),
  revenue24h: z.number(),
  apy: z.number().optional(),
  dominanceScore: z.number(),
  healthScore: z.number(),
  riskScore: z.number(),
  audits: z.number(),
  auditLink: z.string().optional(),
  auditStatus: z.enum(["audited", "partial", "unaudited"]),
  oracles: z.array(z.string()),
  forkedFrom: z.array(z.string()).optional(),
  riskFactors: z.array(z.string()),
  warning: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable(),
});

type ProtocolResponse = z.infer<typeof ProtocolDetailResponse>;

// Fetch base chain TVL history
async function fetchBaseChainHistory() {
  return cache.getOrFetch("chain-history-base", CACHE_TTL.TVL_HISTORY, async () => {
    try {
      const res = await fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { cache: "no-store" });
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  });
}

// Fetch all protocols (cached) to look up individual protocol data
async function fetchAllProtocols() {
  return cache.getOrFetch("all-protocols", CACHE_TTL.PROTOCOL_LIST, async () => {
    try {
      const res = await fetch("https://api.llama.fi/protocols", { cache: "no-store" });
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  });
}

// Calculate health score (same logic as protocol-aggregator.ts)
function calculateHealthScore(proto: {
  audits: number; tvl: number; tvlChange24h: number;
  tvlChange7d: number; category: string; oracles: string[];
  forkedFrom?: string[]; apy?: number;
}): { score: number; riskFactors: string[] } {
  let score = 50;
  const riskFactors: string[] = [];

  score += proto.audits * 5;
  if (proto.audits < 1) { riskFactors.push("No audits"); score -= 15; }

  const CATEGORY_BASELINE: Record<string, number> = {
    Lending: 15, Dexes: 15, "Liquid Staking": 20, CDP: 15,
    Yield: 5, Derivatives: 10, Options: 8,
  };
  score += CATEGORY_BASELINE[proto.category] || 5;

  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  else { riskFactors.push("Low TVL"); score -= 10; }

  if (Math.abs(proto.tvlChange7d) > 25) { riskFactors.push("High TVL volatility"); score -= 15; }
  else if (proto.tvlChange7d < -10) { riskFactors.push("TVL declining"); score -= 8; }
  if (Math.abs(proto.tvlChange24h) > 10) { riskFactors.push("Extreme 24h TVL swing"); score -= 10; }
  if (proto.oracles.length < 2) { riskFactors.push("Limited oracle diversity"); score -= 5; }
  if (proto.forkedFrom?.length) score += 3;
  if ((proto.apy || 0) > 1000) { riskFactors.push("Suspiciously high APY"); score -= 10; }

  score = Math.max(0, Math.min(100, score));
  return { score, riskFactors };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== "string" || slug.length > 100 || !/^[a-z0-9\-]+$/.test(slug)) {
      return NextResponse.json({ error: "Invalid protocol slug" }, { status: 400 });
    }

    const [chainHistory, allProtocols] = await Promise.all([
      fetchBaseChainHistory(),
      fetchAllProtocols(),
    ]);

    // Find the protocol by matching slugs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = allProtocols.find((p: any) =>
      p.slug === slug || p.id === slug || p.name.toLowerCase().replace(/ /g, "-") === slug
    );

    if (!proto) {
      return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
    }

    const baseTvl = proto.chainTvls?.Base || 0;
    const tvlChange24h = proto.change_1d || 0;
    const tvlChange7d = proto.change_7d || 0;
    const { score: healthScore, riskFactors } = calculateHealthScore({
      audits: proto.audits || 0,
      tvl: baseTvl,
      tvlChange24h,
      tvlChange7d,
      category: proto.category || "DeFi",
      oracles: proto.oracles || [],
      forkedFrom: proto.forkedFrom,
      apy: proto.apyMean30d,
    });

    const result: ProtocolResponse = {
      id: proto.id || proto.slug || proto.name.toLowerCase().replace(/ /g, "-"),
      name: proto.name,
      slug: proto.slug || slug,
      category: proto.category || "DeFi",
      chains: proto.chains || ["Base"],
      logo: proto.logo,
      tvl: baseTvl,
      tvlChange24h,
      tvlChange7d,
      tvlChange30d: proto.change_1m,
      fees24h: 0,
      feesAnnualized: Math.round(baseTvl * ((proto.apyMean30d || 0) / 100 + 0.01)),
      revenue24h: 0,
      apy: proto.apyMean30d > 0 ? proto.apyMean30d : undefined,
      dominanceScore: 0,
      healthScore,
      riskScore: 100 - healthScore,
      audits: proto.audits || 0,
      auditLink: proto.audit_links?.[0],
      auditStatus: (proto.audits || 0) >= 2 ? "audited" : (proto.audits || 0) >= 1 ? "partial" : "unaudited",
      oracles: proto.oracles || [],
      forkedFrom: proto.forkedFrom,
      riskFactors,
      warning: riskFactors.length > 3 ? "HIGH" : riskFactors.length === 0 ? null : "LOW",
    };

    // Get TVL history from the chain-level data (protocol-specific history isn't available via DefiLlama)
    const tvlHistory = chainHistory
      .slice(-90)
      .map((d: { date: number; tvl: number }) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tvl: d.tvl,
      }));
    // Validate the tvlHistory shape
    protocolTvlItem.array().safeParse(
      chainHistory.slice(-90).map((d: { date: number; tvl: number }) => ({ date: d.date, tvl: d.tvl }))
    );

    return NextResponse.json({
      protocol: result,
      tvlHistory,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Protocol detail error:", err);
    return NextResponse.json({ error: "Failed to fetch protocol data" }, { status: 500 });
  }
}
