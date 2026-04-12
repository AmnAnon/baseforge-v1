// src/lib/data/indexers/types.ts
// Shared types for the indexer abstraction layer.
// All indexer implementations return these normalized types.

export interface SwapEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  protocol: "aerodrome" | "uniswap-v3" | "uniswap-v4";
  pool: string;
  sender: string;
  recipient: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountUSD: number;
  sqrtPriceX96?: string;
  tick?: number;
  liquidity?: string;
}

export interface LiquidityEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  protocol: "aerodrome" | "uniswap-v3" | "uniswap-v4";
  pool: string;
  provider: string;
  action: "add" | "remove";
  token0: string;
  token1: string;
  amount0: string;
  amount1: string;
  amountUSD: number;
}

export interface WhaleFlow {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  protocol: string;
  type: "swap" | "transfer" | "liquidity_add" | "liquidity_remove" | "borrow" | "repay" | "deposit" | "withdraw";
  from: string;
  to: string;
  amountUSD: number;
  token: string;
  tokenAmount: string;
}

export interface LendingEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  protocol: "seamless" | "aave-v3" | "moonwell" | "compound-v3";
  action: "deposit" | "withdraw" | "borrow" | "repay" | "liquidation";
  user: string;
  asset: string;
  amount: string;
  amountUSD: number;
  onBehalfOf?: string;
  // Liquidation-specific
  collateralAsset?: string;
  debtAsset?: string;
  liquidator?: string;
}

export interface ProtocolMetrics {
  protocol: string;
  swapVolume24h: number;
  swapCount24h: number;
  uniqueTraders24h: number;
  tvl: number;
  largestSwap24h: number;
  fees24h: number;
  netFlow24h: number; // positive = inflows, negative = outflows
}

export interface IndexerHealthStatus {
  provider: string;
  healthy: boolean;
  latencyMs: number;
  lastBlock: number;
  chainHead: number;
  lag: number;
  lastChecked: number;
}

// Query parameters for indexer methods
export interface TimeRange {
  fromTimestamp?: number;
  toTimestamp?: number;
  fromBlock?: number;
  toBlock?: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface SwapQuery extends TimeRange, PaginationParams {
  protocol?: SwapEvent["protocol"];
  pool?: string;
  minAmountUSD?: number;
  sender?: string;
}

export interface WhaleQuery extends TimeRange, PaginationParams {
  minAmountUSD?: number;
  type?: WhaleFlow["type"];
  protocol?: string;
}

export interface LendingQuery extends TimeRange, PaginationParams {
  protocol?: LendingEvent["protocol"];
  action?: LendingEvent["action"];
  minAmountUSD?: number;
  user?: string;
}
