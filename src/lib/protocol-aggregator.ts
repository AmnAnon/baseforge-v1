// src/lib/protocol-aggregator.ts
// Unified protocol data — merges DefiLlama + CoinGecko + Indexer on-chain metrics.
// The indexer layer provides real swap volume, fee estimates, and net flows
// that DefiLlama alone can't deliver.

import { cache, CACHE_TTL } from "./cache";
import { logger } from "./logger";
import { getProtocolEvents } from "./data/indexers";
import type { ProtocolMetrics } from "./data/indexers";
import { calculateHealthScore } from "./risk";

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

// Case-insensitive Base TVL lookup — DefiLlama key capitalisation varies by protocol
function getBaseTvl(p: { chainTvls?: Record<string, number> }): number {
  return (
    p.chainTvls?.["Base"] ??
    p.chainTvls?.["base"] ??
    p.chainTvls?.["BASE"] ??
    0
  );
}

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
        getBaseTvl(p) > 100_000 && !excludedCategories.includes(p.category || "")
    )
    .sort(
      (a: { chainTvls?: Record<string, number> }, b: { chainTvls?: Record<string, number> }) =>
        getBaseTvl(b) - getBaseTvl(a)
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
      const tvl = getBaseTvl(p);
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
