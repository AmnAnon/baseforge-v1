// src/app/api/protocol-aggregator/route.ts
/**
 * Protocol Aggregator API
 * Merges DefiLlama + on-chain data into unified protocol profiles.
 * Returns Top 10 Base protocols with complete metrics.
 * 
 * Cache: 5 min (in-memory, swappable to Upstash later)
 */
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

// Category trust scores (audit standards vary by protocol type)
const CATEGORY_TRUST: Record<string, number> = {
  "Lending": 4, "Dexes": 4, "CDP": 3, "Yield Aggregator": 2,
  "Yield": 2, "Bridge": 0, "Staking Pool": 1, "Liquid Staking": 3,
};

// Known protocol logos
const PROTOCOL_LOGOS: Record<string, string> = {
  "Aerodrome": "https://icons.llamao.fi/icons/protocols/aerodrome",
  "Moonwell": "https://icons.llamao.fi/icons/protocols/moonwell",
  "Sonne Finance": "https://icons.llamao.fi/icons/protocols/sonne-finance",
  "Seamless Protocol": "https://icons.llamao.fi/icons/protocols/seamless-protocol",
  "Compound V3": "https://icons.llamao.fi/icons/protocols/compound-v3",
  "Aave V3": "https://icons.llamao.fi/icons/protocols/aave-v3",
};

interface RawProtocol {
  name: string;
  slug: string;
  symbol?: string;
  category: string;
  tvl: number;
  chainTvlsBase: number;
  change_1d: number;
  change_7d: number;
  audits?: number;
  audit_links?: string[];
  forkedFrom?: string[];
  oracles?: string[];
  logo?: string;
  mcap?: number;
}

interface AggregatedProtocol {
  id: string;
  name: string;
  symbol: string;
  category: string;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  dominanceScore: number;
  protocolScore: number; // 0-100
  riskScore: number;
  auditStatus: "audited" | "partial" | "unaudited";
  logo: string;
  forks: string[];
  oracles: string[];
  riskFactors: string[];
  warning?: string;
}

function calculateProtocolScore(p: RawProtocol, totalTvl: number): {
  score: number;
  riskFactors: string[];
  warning?: string;
} {
  let score = 50; // Neutral baseline
  const riskFactors: string[] = [];

  // TVL dominance trust
  const dominance = p.chainTvlsBase / totalTvl;
  score += Math.min(dominance * 30, 15);

  // Category audit baseline
  score += (CATEGORY_TRUST[p.category] || 1) * 2;

  // Audit count bonus
  const audits = p.audits || 0;
  score += Math.min(audits * 3, 12);

  // Oracle security
  const oracles = p.oracles?.length || 0;
  if (oracles >= 3) score += 5;
  else if (oracles >= 1) score += 2;
  else riskFactors.push("No oracle");

  // Fork risk (forks of established protocols inherit some security)
  if (p.forkedFrom?.length && p.forkedFrom.length > 0) {
    score += 3;
  }

  // TVL stability check
  if (p.change_7d < -10) riskFactors.push("TVL declining");
  score -= Math.max(p.change_7d * -1.5, -10); // Penalty for drops

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    riskFactors,
    warning: riskFactors.length > 2 ? "HIGH" : riskFactors.length > 0 ? "MEDIUM" : undefined,
  };
}

export async function GET() {
  try {
    const cached = await cache.get<AggregatedProtocol[]>("aggregator-protocols");
    if (cached) return NextResponse.json(cached);

    const [protocolsRes, tvlRes] = await Promise.all([
      fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
      fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { cache: "no-store" }),
    ]);

    if (!protocolsRes.ok || !tvlRes.ok) throw new Error("DefiLlama request failed");

    const rawProtocols: RawProtocol[] = await protocolsRes.json();
    const tvlHistory = await tvlRes.json();
    const totalBaseTvl = tvlHistory.length > 0 ? tvlHistory[tvlHistory.length - 1].tvl : 0;

    // Filter + rank base protocols
    const baseProtos = rawProtocols
      .filter(p => p.chainTvlsBase > 500_000)
      .sort((a, b) => b.chainTvlsBase - a.chainTvlsBase)
      .slice(0, 10);

    const aggregated: AggregatedProtocol[] = baseProtos.map(p => {
      const { score, riskFactors, warning } = calculateProtocolScore(p, totalBaseTvl);
      const dominance = totalBaseTvl > 0 ? Math.round((p.chainTvlsBase / totalBaseTvl) * 10000) / 100 : 0;

      return {
        id: p.slug,
        name: p.name,
        symbol: p.symbol || p.name.slice(0, 6),
        category: p.category,
        tvl: p.chainTvlsBase,
        tvlChange24h: p.change_1d,
        tvlChange7d: p.change_7d,
        dominanceScore: dominance,
        protocolScore: score,
        riskScore: 100 - score,
        auditStatus: (p.audits || 0) >= 3 ? "audited" : (p.audits || 0) >= 1 ? "partial" : "unaudited",
        logo: PROTOCOL_LOGOS[p.name] || p.logo || "",
        forks: p.forkedFrom || [],
        oracles: p.oracles || [],
        riskFactors,
        warning,
      };
    });

    // Cache the result
    await cache.set("aggregator-protocols", aggregated, CACHE_TTL.TVL_HISTORY);

    return NextResponse.json(aggregated);
  } catch (err) {
    console.error("Protocol aggregator error:", err);
    return NextResponse.json({ error: "Aggregation failed" }, { status: 500 });
  }
}
