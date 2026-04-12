// src/lib/data/indexers/schemas.ts
// Zod schemas for indexer responses — validates raw data before it enters our system.

import { z } from "zod";

// ─── Core event schemas ─────────────────────────────────────────

export const SwapEventSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number(),
  timestamp: z.number(),
  protocol: z.enum(["aerodrome", "uniswap-v3", "uniswap-v4"]),
  pool: z.string(),
  sender: z.string(),
  recipient: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string(),
  amountOut: z.string(),
  amountUSD: z.number(),
  sqrtPriceX96: z.string().optional(),
  tick: z.number().optional(),
  liquidity: z.string().optional(),
});

export const LiquidityEventSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number(),
  timestamp: z.number(),
  protocol: z.enum(["aerodrome", "uniswap-v3", "uniswap-v4"]),
  pool: z.string(),
  provider: z.string(),
  action: z.enum(["add", "remove"]),
  token0: z.string(),
  token1: z.string(),
  amount0: z.string(),
  amount1: z.string(),
  amountUSD: z.number(),
});

export const WhaleFlowSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number(),
  timestamp: z.number(),
  protocol: z.string(),
  type: z.enum(["swap", "transfer", "liquidity_add", "liquidity_remove", "borrow", "repay", "deposit", "withdraw"]),
  from: z.string(),
  to: z.string(),
  amountUSD: z.number(),
  token: z.string(),
  tokenAmount: z.string(),
});

export const LendingEventSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number(),
  timestamp: z.number(),
  protocol: z.enum(["seamless", "aave-v3", "moonwell", "compound-v3"]),
  action: z.enum(["deposit", "withdraw", "borrow", "repay", "liquidation"]),
  user: z.string(),
  asset: z.string(),
  amount: z.string(),
  amountUSD: z.number(),
  onBehalfOf: z.string().optional(),
  collateralAsset: z.string().optional(),
  debtAsset: z.string().optional(),
  liquidator: z.string().optional(),
});

export const ProtocolMetricsSchema = z.object({
  protocol: z.string(),
  swapVolume24h: z.number(),
  swapCount24h: z.number(),
  uniqueTraders24h: z.number(),
  tvl: z.number(),
  largestSwap24h: z.number(),
  fees24h: z.number(),
  netFlow24h: z.number(),
});

export const IndexerHealthSchema = z.object({
  provider: z.string(),
  healthy: z.boolean(),
  latencyMs: z.number(),
  lastBlock: z.number(),
  chainHead: z.number(),
  lag: z.number(),
  lastChecked: z.number(),
});

// ─── Aggregated response schemas ────────────────────────────────

export const SwapsResponseSchema = z.object({
  swaps: z.array(SwapEventSchema),
  total: z.number(),
  source: z.string(),
  timestamp: z.number(),
  isStale: z.boolean().default(false),
});

export const WhaleFlowsResponseSchema = z.object({
  flows: z.array(WhaleFlowSchema),
  total: z.number(),
  summary: z.object({
    totalVolumeUSD: z.number(),
    largestFlowUSD: z.number(),
    netFlowUSD: z.number(),
    byType: z.record(z.string(), z.number()),
  }),
  source: z.string(),
  timestamp: z.number(),
  isStale: z.boolean().default(false),
});

export const LendingResponseSchema = z.object({
  events: z.array(LendingEventSchema),
  total: z.number(),
  summary: z.object({
    totalDepositsUSD: z.number(),
    totalBorrowsUSD: z.number(),
    totalLiquidationsUSD: z.number(),
    netFlowUSD: z.number(),
  }),
  source: z.string(),
  timestamp: z.number(),
  isStale: z.boolean().default(false),
});

// ─── Type exports from schemas ──────────────────────────────────

export type SwapEventZ = z.infer<typeof SwapEventSchema>;
export type WhaleFlowZ = z.infer<typeof WhaleFlowSchema>;
export type LendingEventZ = z.infer<typeof LendingEventSchema>;
export type ProtocolMetricsZ = z.infer<typeof ProtocolMetricsSchema>;
export type SwapsResponse = z.infer<typeof SwapsResponseSchema>;
export type WhaleFlowsResponse = z.infer<typeof WhaleFlowsResponseSchema>;
export type LendingResponse = z.infer<typeof LendingResponseSchema>;
