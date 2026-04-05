// src/lib/protocol-aggregator.ts
// Unified protocol data — merges DefiLlama + CoinGecko into enriched objects

import { cache, CACHE_TTL } from "./cache";

export interface ProtocolData {
  // Core identity
  id: string;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  logo?: string;

  // TVL metrics
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  tvlChange30d?: number;

  // Financial metrics
  fees24h: number;
  feesAnnualized: number;
  revenue24h: number;
  apy?: number;
  yieldApy?: number;
  lendingApy?: number;

  // Token metrics (if has token)
  tokenPrice?: number;
  tokenChange24h?: number;
  marketCap?: number;
  circulatingSupply?: number;

  // Computed scores
  dominanceScore: number;   // % of total Base TVL
  healthScore: number;      // 0-100, higher = better
  riskScore: number;        // 0-100, lower = better

  // Audit & security
  audits: number;
  auditLink?: string;
  auditStatus: "audited" | "partial" | "unaudited";
  oracles: string[];
  forkedFrom?: string[];

  // Risk signals
  riskFactors: string[];
  warning?: "HIGH" | "MEDIUM" | "LOW" | null;
}

// Category trust baselines (higher = more proven)
const CATEGORY_BASELINE: Record<string, number> = {
  "Lending": 15,
  "Dexes": 15,
  "Liquid Staking": 20,
  "CDP": 15,
  "Yield": 5,
  "Bridge": 0,
  "Derivatives": 10,
  "Options": 8,
};

// Risk signal thresholds
const RISK_THRESHOLDS = {
  MAX_TVL_DROp_7D: 0.25, // 25% drop in 7d
  MAX_TVL_DROP_24H: 0.1, // 10% drop in 24h
  MIN_AUDITS: 1,
  MIN_ORACLES: 2,
  MAX_SINGLE_PROTOCOL_DOMINANCE: 0.4, // 40%
  SUSPICIOUS_APY: 1000,
};

export function calculateHealthScore(proto: {
  audits: number;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  category: string;
  oracles: string[];
  forkedFrom?: string[];
  apy?: number;
}): { score: number; riskFactors: string[] } {
  let score = 50; // Neutral baseline
  const riskFactors: string[] = [];

  // Audit bonus
  score += proto.audits * 5;
  if (proto.audits < RISK_THRESHOLDS.MIN_AUDITS) {
    riskFactors.push("No audits");
    score -= 15;
  }

  // Category trust
  score += CATEGORY_BASELINE[proto.category] || 5;

  // TVL size trust
  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  else {
    riskFactors.push("Low TVL");
    score -= 10;
  }

  // Volatility check
  if (Math.abs(proto.tvlChange7d) > RISK_THRESHOLDS.MAX_TVL_DROp_7D * 100) {
    riskFactors.push("High TVL volatility");
    score -= 15;
  } else if (proto.tvlChange7d < -10) {
    riskFactors.push("TVL declining");
    score -= 8;
  }

  if (Math.abs(proto.tvlChange24h) > RISK_THRESHOLDS.MAX_TVL_DROP_24H * 100) {
    riskFactors.push("Extreme 24h TVL swing");
    score -= 10;
  }

  // Oracle diversity
  if (proto.oracles.length < RISK_THRESHOLDS.MIN_ORACLES) {
    riskFactors.push("Limited oracle diversity");
    score -= 5;
  }

  // Fork safety (forked = somewhat proven code)
  if (proto.forkedFrom?.length) score += 3;

  // APY sanity check
  if ((proto.apy || 0) > RISK_THRESHOLDS.SUSPICIOUS_APY) {
    riskFactors.push("Suspiciously high APY");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  return { score, riskFactors };
}

type AggregateResult = {
  protocols: ProtocolData[];
  summary: {
    totalProtocols: number;
    totalTvl: number;
    avgHealth: number;
    highRiskCount: number;
    unauditedCount: number;
    dominantProtocol?: string;
  };
};

export async function aggregateProtocols(): Promise<AggregateResult> {
  const cached = await cache.get<AggregateResult>("protocol-aggregator");
  if (cached) return cached;

  // Fetch raw protocol data
  const [allProtocolsRes, baseTvlRes] = await Promise.all([
    fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
    fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { cache: "no-store" }),
  ]);

  if (!allProtocolsRes.ok || !baseTvlRes.ok) {
    throw new Error("Failed to fetch protocol data");
  }

  const allProtocols = await allProtocolsRes.json();
  const baseTvlHistory = await baseTvlRes.json();
  const totalBaseTvl = baseTvlHistory.length > 0 ? baseTvlHistory[baseTvlHistory.length - 1].tvl : 0;

  // Filter to Base chain protocols
  const excludedCategories = ["CEX", "Chain", "Bridge"];
  const baseProtocols = allProtocols
    .filter(
      (p: { chainTvls?: Record<string, number>; category?: string }) =>
        (p.chainTvls?.Base || 0) > 100_000 && !excludedCategories.includes(p.category || "")
    )
    .sort(
      (a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) =>
        (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0)
    );

  const aggregated: ProtocolData[] = baseProtocols
    .slice(0, 50) // Top 50 by TVL
    .map((p: {
      id?: string; name: string; slug?: string; category: string; chains?: string[];
      chainTvls: Record<string, number>; change_1d?: number; change_7d?: number; change_1m?: number;
      audits?: number; audit_links?: string[]; oracles?: string[]; forkedFrom?: string[];
      logo?: string; apyMean30d?: number; tvlPrevDay?: number; tvlPrevWeek?: number;
    }) => {
      const tvl = p.chainTvls.Base || 0;
      const dominanceScore = totalBaseTvl > 0 ? (tvl / totalBaseTvl) * 100 : 0;

      const { score, riskFactors } = calculateHealthScore({
        audits: p.audits || 0,
        tvl,
        tvlChange24h: p.change_1d || 0,
        tvlChange7d: p.change_7d || 0,
        category: p.category,
        oracles: p.oracles || [],
        forkedFrom: p.forkedFrom,
      });

      const warning = riskFactors.length > 3 ? "HIGH" : riskFactors.length === 0 ? null : "LOW";

      return {
        id: p.id || p.slug || p.name.toLowerCase().replace(/ /g, "-"),
        name: p.name,
        slug: p.slug || p.name.toLowerCase().replace(/ /g, "-"),
        category: p.category,
        chains: p.chains || ["Base"],
        logo: p.logo,
        tvl,
        tvlChange24h: p.change_1d || 0,
        tvlChange7d: p.change_7d || 0,
        tvlChange30d: p.change_1m,
        fees24h: 0,
        feesAnnualized: 0,
        revenue24h: 0,
        apy: p.apyMean30d,
        dominanceScore: Math.round(dominanceScore * 100) / 100,
        healthScore: score,
        riskScore: 100 - score,
        audits: p.audits || 0,
        auditLink: p.audit_links?.[0],
        auditStatus: (p.audits || 0) >= 2 ? "audited" : (p.audits || 0) >= 1 ? "partial" : "unaudited",
        oracles: p.oracles || [],
        forkedFrom: p.forkedFrom,
        riskFactors,
        warning,
      };
    });

  const summary = {
    totalProtocols: aggregated.length,
    totalTvl: aggregated.reduce((s, p) => s + p.tvl, 0),
    avgHealth: aggregated.length > 0 ? Math.round(aggregated.reduce((s, p) => s + p.healthScore, 0) / aggregated.length) : 0,
    highRiskCount: aggregated.filter(p => p.riskScore > 50).length,
    unauditedCount: aggregated.filter(p => p.auditStatus === "unaudited").length,
    dominantProtocol: aggregated[0]?.name,
  };

  cache.set("protocol-aggregator", { protocols: aggregated, summary }, CACHE_TTL.TVL_HISTORY);
  return { protocols: aggregated, summary };
}
