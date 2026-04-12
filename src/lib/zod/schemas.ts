// src/lib/zod/schemas.ts
// Zod schemas for every external API response — DefiLlama, CoinGecko, Etherscan
// Plus derived schemas for our own API routes with isStale tracking.

import { z } from "zod";

// ─── DefiLlama ──────────────────────────────────────────────

export const TVLHistoryEntrySchema = z.object({
  date: z.union([z.number(), z.string()]),
  tvl: z.number(),
});

export const ProtocolSchema = z.object({
  id: z.coerce.string().optional(),
  name: z.string(),
  slug: z.string().optional().default(""),
  symbol: z.string().optional().default(""),
  logo: z.string().optional().default(""),
  url: z.string().optional().default(""),
  category: z.string().optional().default("Other"),
  chainTvls: z.record(z.string(), z.number()).default({}),
  tvl: z.number().optional().default(0),
  change_1d: z.number().optional().default(0),
  change_7d: z.number().optional().default(0),
  apyMean30d: z.number().optional().default(0),
  tvlPrevDay: z.number().optional(),
  tvlPrevWeek: z.number().optional(),
  chains: z.array(z.string()).optional().default([]),
});

export const DefiLlamaProtocolsSchema = z.array(
  ProtocolSchema.extend({
    chainTvls: z.record(z.string(), z.union([z.number(), z.array(TVLHistoryEntrySchema)])).default({}),
  }).passthrough()
);

export const DefiLlamaTvlHistorySchema = z.array(z.object({ date: z.number(), tvl: z.number() }));

export const YieldPoolSchema = z.object({
  pool: z.string(),
  chain: z.string(),
  project: z.string(),
  symbol: z.string(),
  apy: z.number().optional().default(0),
  apyBase: z.number().optional().default(0),
  apyReward: z.number().optional().default(0),
  tvlUsd: z.number().optional().default(0),
});

export const DefiLlamaYieldsSchema = z.object({
  status: z.string().optional(),
  data: z.array(YieldPoolSchema).optional().default([]),
});

// ─── CoinGecko ──────────────────────────────────────────────

export const CoinGeckoSimplePriceSchema = z.record(
  z.string(),
  z.object({
    usd: z.number(),
    usd_market_cap: z.number().optional(),
    usd_24h_vol: z.number().optional(),
    usd_24h_change: z.number().optional(),
  })
);

// ─── Etherscan ──────────────────────────────────────────────

export const EtherscanTxSchema = z.object({
  blockNumber: z.string(),
  timeStamp: z.string(),
  hash: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  gasPrice: z.string(),
  gasUsed: z.string().optional().optional(),
  isError: z.string().default("0"),
});

export const EtherscanApiResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.union([z.array(EtherscanTxSchema.passthrough()), z.string()]).default([]),
});

// ─── Derived API response schemas (our own routes) ─────────

export const BaseMetricsSchema = z.object({
  totalTvl: z.number(),
  totalProtocols: z.number(),
  avgApy: z.number(),
  change24h: z.number(),
});

export const ProtocolSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  tvl: z.number(),
  change24h: z.number().default(0),
  logo: z.string().default(""),
  category: z.string().default(""),
});

export const AnalyticsResponseSchema = z.object({
  baseMetrics: BaseMetricsSchema.optional().nullable(),
  tvlHistory: z.array(TVLHistoryEntrySchema).optional().default([]),
  protocols: z.array(ProtocolSummarySchema).optional().default([]),
  protocolData: z.record(z.string(), z.unknown()).optional().default({}),
  timestamp: z.number(),
  isStale: z.boolean().optional().default(false),
});

export const MarketResponseSchema = z.object({
  tokens: z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    logo: z.string().default(""),
    price: z.number(),
    change24h: z.number(),
    volume24h: z.number(),
    marketCap: z.number(),
  })).default([]),
  summary: z.object({
    totalTokens: z.number(),
    avgChange24h: z.number(),
    totalVolume24h: z.number(),
  }),
  topGainers: z.array(z.unknown()).default([]),
  topLosers: z.array(z.unknown()).default([]),
  topByVolume: z.array(z.unknown()).default([]),
  timestamp: z.number(),
  isStale: z.boolean().optional().default(false),
});

export const ChartsResponseSchema = z.object({
  tvlData: z.array(z.object({ date: z.string(), tvl: z.number() })).default([]),
  feesData: z.array(z.object({ date: z.string(), fees: z.number() })).default([]),
  revenueData: z.array(z.object({ date: z.string(), revenue: z.number() })).default([]),
  supplyBorrowData: z.array(z.object({ date: z.string(), supply: z.number(), borrow: z.number() })).default([]),
  isStale: z.boolean().optional().default(false),
});

export const RiskResponseSchema = z.object({
  protocols: z.array(z.unknown()).default([]),
  summary: z.object({
    totalAnalyzed: z.number(),
    avgHealthScore: z.number(),
    highRiskCount: z.number(),
    unauditedCount: z.number(),
    dominantProtocol: z.string(),
    totalBaseTVL: z.number(),
    concentrationRisk: z.enum(["HIGH", "MEDIUM", "LOW"]),
  }),
  timestamp: z.number(),
  isStale: z.boolean().optional().default(false),
});

export const WhalesResponseSchema = z.object({
  whales: z.array(z.unknown()).default([]),
  summary: z.object({
    total: z.number(),
    largest: z.number(),
    avgSize: z.number(),
    types: z.record(z.string(), z.number()).default({}),
  }),
  timestamp: z.number(),
  isStale: z.boolean().optional().default(false),
});

export const RevenueResponseSchema = z.object({
  protocols: z.array(z.unknown()).default([]),
  aggregate: z.object({
    totalFees24h: z.number(),
    totalFeesAnnualized: z.number(),
    protocolCount: z.number(),
    timestamp: z.number(),
  }),
  timestamp: z.number(),
  isStale: z.boolean().optional().default(false),
});

export const AlertsResponseSchema = z.object({
  alerts: z.array(z.object({
    id: z.string(),
    ruleId: z.string().nullable(),
    protocol: z.string(),
    network: z.string().nullable(),
    currentValue: z.string(),
    message: z.string(),
    severity: z.enum(["critical", "warning", "info"]),
    triggeredAt: z.string(),
    acknowledged: z.boolean(),
    acknowledgedAt: z.string().nullable(),
  })).default([]),
  timestamp: z.number(),
  isStale: z.boolean().optional().default(false),
});

export const AlertRuleRequestSchema = z.object({
  type: z.enum(["tvl_drop", "utilization_spike", "apy_anomaly", "whale_movement", "health_decrease"]),
  protocol: z.string().min(1),
  network: z.string().nullable().optional(),
  condition: z.string().min(1),
  threshold: z.number(),
  severity: z.enum(["critical", "warning", "info"]),
  cooldownMinutes: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

// Type exports
export type DefiLlamaProtocol = z.infer<typeof ProtocolSchema>;
export type TVLHistoryEntry = z.infer<typeof TVLHistoryEntrySchema>;
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
export type EtherscanTx = z.infer<typeof EtherscanTxSchema>;
export type YieldPool = z.infer<typeof YieldPoolSchema>;
