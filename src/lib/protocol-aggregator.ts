// src/lib/protocol-aggregator.ts
// Unified protocol data — merges DefiLlama + CoinGecko + Indexer on-chain metrics.
// The indexer layer provides real swap volume, fee estimates, and net flows
// that DefiLlama alone can't deliver.

import { cache, CACHE_TTL } from "./cache";
import { logger } from "./logger";
import { getProtocolEvents } from "./data/indexers";
import type { ProtocolMetrics } from "./data/indexers";

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

  // Financial metrics (enriched by indexer)
  fees24h: number;
  feesAnnualized: number;
  revenue24h: number;
  apy?: number;
  yieldApy?: number;
  lendingApy?: number;

  // On-chain activity (from indexer)
  swapVolume24h: number;
  swapCount24h: number;
  uniqueTraders24h: number;
  largestSwap24h: number;
  netFlow24h: number;

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

  // Data source tracking
  dataSource?: string;
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
  MAX_TVL_DROP_7D: 0.25,
  MAX_TVL_DROP_24H: 0.1,
  MIN_AUDITS: 1,
  MIN_ORACLES: 2,
  MAX_SINGLE_PROTOCOL_DOMINANCE: 0.4,
  SUSPICIOUS_APY: 1000,
  // New: on-chain activity signals
  LOW_VOLUME_RATIO: 0.001,    // Volume < 0.1% of TVL is suspicious
  HIGH_OUTFLOW_RATIO: 0.1,    // Net outflow > 10% of TVL
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
  // New on-chain signals
  swapVolume24h?: number;
  netFlow24h?: number;
  uniqueTraders24h?: number;
}): { score: number; riskFactors: string[] } {
  let score = 50; // Neutral baseline
  const riskFactors: string[] = [];

  // ── Existing checks ──

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
  if (Math.abs(proto.tvlChange7d) > RISK_THRESHOLDS.MAX_TVL_DROP_7D * 100) {
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

  // Fork safety
  if (proto.forkedFrom?.length) score += 3;

  // APY sanity check
  if ((proto.apy || 0) > RISK_THRESHOLDS.SUSPICIOUS_APY) {
    riskFactors.push("Suspiciously high APY");
    score -= 10;
  }

  // ── New: on-chain activity signals (from indexer) ──

  if (proto.swapVolume24h !== undefined && proto.tvl > 0) {
    const volumeRatio = proto.swapVolume24h / proto.tvl;

    // Healthy activity: volume is reasonable relative to TVL
    if (volumeRatio > 0.01) {
      score += 5; // Active protocol
    } else if (volumeRatio < RISK_THRESHOLDS.LOW_VOLUME_RATIO && proto.category === "Dexes") {
      riskFactors.push("Very low trading volume relative to TVL");
      score -= 5;
    }
  }

  if (proto.netFlow24h !== undefined && proto.tvl > 0) {
    const outflowRatio = -proto.netFlow24h / proto.tvl;
    if (outflowRatio > RISK_THRESHOLDS.HIGH_OUTFLOW_RATIO) {
      riskFactors.push("Significant net outflows (>10% TVL)");
      score -= 10;
    } else if (proto.netFlow24h > 0) {
      score += 3; // Net inflows = positive signal
    }
  }

  if (proto.uniqueTraders24h !== undefined) {
    if (proto.uniqueTraders24h > 100) score += 3;
    else if (proto.uniqueTraders24h > 10) score += 1;
    else if (proto.uniqueTraders24h === 0 && proto.category === "Dexes") {
      riskFactors.push("Zero unique traders in 24h");
      score -= 5;
    }
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
    totalSwapVolume24h: number;
    totalFees24h: number;
  };
};

// Protocols we can enrich with on-chain indexer data
const INDEXER_PROTOCOLS = new Set([
  "aerodrome",
  "uniswap-v3",
]);

export async function aggregateProtocols(): Promise<AggregateResult> {
  const cached = await cache.get<AggregateResult>("protocol-aggregator-v2");
  if (cached) return cached;

  // Fetch raw protocol data from DefiLlama
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

  // Fetch on-chain metrics for top protocols (in parallel, with error tolerance)
  const top50 = baseProtocols.slice(0, 50);
  const metricsMap = new Map<string, ProtocolMetrics>();

  const metricsPromises = top50
    .filter((p: { slug?: string; name: string }) => {
      const slug = p.slug || p.name.toLowerCase().replace(/ /g, "-");
      return INDEXER_PROTOCOLS.has(slug);
    })
    .map(async (p: { slug?: string; name: string }) => {
      const slug = p.slug || p.name.toLowerCase().replace(/ /g, "-");
      try {
        const metrics = await getProtocolEvents(slug);
        metricsMap.set(slug, metrics);
      } catch (err) {
        logger.debug(`Failed to fetch indexer metrics for ${slug}`, {
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    });

  await Promise.allSettled(metricsPromises);

  const aggregated: ProtocolData[] = top50
    .map((p: {
      id?: string; name: string; slug?: string; category: string; chains?: string[];
      chainTvls: Record<string, number>; change_1d?: number; change_7d?: number; change_1m?: number;
      audits?: number; audit_links?: string[]; oracles?: string[]; forkedFrom?: string[];
      logo?: string; apyMean30d?: number;
    }) => {
      const tvl = p.chainTvls.Base || 0;
      const slug = p.slug || p.name.toLowerCase().replace(/ /g, "-");
      const dominanceScore = totalBaseTvl > 0 ? (tvl / totalBaseTvl) * 100 : 0;

      // Get on-chain metrics if available
      const metrics = metricsMap.get(slug);

      const { score, riskFactors } = calculateHealthScore({
        audits: p.audits || 0,
        tvl,
        tvlChange24h: p.change_1d || 0,
        tvlChange7d: p.change_7d || 0,
        category: p.category,
        oracles: p.oracles || [],
        forkedFrom: p.forkedFrom,
        apy: p.apyMean30d,
        // On-chain enrichment
        swapVolume24h: metrics?.swapVolume24h,
        netFlow24h: metrics?.netFlow24h,
        uniqueTraders24h: metrics?.uniqueTraders24h,
      });

      const warning = riskFactors.length > 3 ? "HIGH" : riskFactors.length === 0 ? null : "LOW";

      return {
        id: p.id || slug,
        name: p.name,
        slug,
        category: p.category,
        chains: p.chains || ["Base"],
        logo: p.logo,
        tvl,
        tvlChange24h: p.change_1d || 0,
        tvlChange7d: p.change_7d || 0,
        tvlChange30d: p.change_1m,
        fees24h: metrics?.fees24h || 0,
        feesAnnualized: (metrics?.fees24h || 0) * 365,
        revenue24h: (metrics?.fees24h || 0) * 0.15, // ~15% protocol take estimate
        apy: p.apyMean30d,
        swapVolume24h: metrics?.swapVolume24h || 0,
        swapCount24h: metrics?.swapCount24h || 0,
        uniqueTraders24h: metrics?.uniqueTraders24h || 0,
        largestSwap24h: metrics?.largestSwap24h || 0,
        netFlow24h: metrics?.netFlow24h || 0,
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
        dataSource: metrics ? "indexer+defillama" : "defillama",
      };
    });

  const totalSwapVolume24h = aggregated.reduce((s, p) => s + p.swapVolume24h, 0);
  const totalFees24h = aggregated.reduce((s, p) => s + p.fees24h, 0);

  const summary = {
    totalProtocols: aggregated.length,
    totalTvl: aggregated.reduce((s, p) => s + p.tvl, 0),
    avgHealth: aggregated.length > 0 ? Math.round(aggregated.reduce((s, p) => s + p.healthScore, 0) / aggregated.length) : 0,
    highRiskCount: aggregated.filter(p => p.riskScore > 50).length,
    unauditedCount: aggregated.filter(p => p.auditStatus === "unaudited").length,
    dominantProtocol: aggregated[0]?.name,
    totalSwapVolume24h,
    totalFees24h,
  };

  const result = { protocols: aggregated, summary };
  cache.set("protocol-aggregator-v2", result, CACHE_TTL.TVL_HISTORY);
  return result;
}
