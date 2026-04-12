// src/lib/data/indexers/index.ts
// Unified Indexer Service — orchestrates Envio HyperSync (primary)
// with Etherscan/DefiLlama fallback, wrapped in cache.
//
// Architecture:
//   1. Check cache first (time-based TTL via existing cache abstraction)
//   2. Try Envio HyperSync (fast, event-level granularity)
//   3. On failure → fall back to Etherscan V2 (slower, tx-level only)
//   4. Cache result with source tag for staleness tracking
//
// All public methods return normalized types from ./types.ts

import { cache } from "@/lib/cache";
import { logger, timing } from "@/lib/logger";
import { monitor } from "@/lib/monitoring";
import * as envio from "./envio-provider";
import * as fallback from "./fallback-provider";
import type {
  SwapEvent,
  WhaleFlow,
  LendingEvent,
  ProtocolMetrics,
  IndexerHealthStatus,
  SwapQuery,
  WhaleQuery,
  LendingQuery,
} from "./types";

// ─── Cache TTLs (milliseconds) ─────────────────────────────────

const CACHE_TTL = {
  SWAPS: 30_000,         // 30s — high-frequency data
  WHALE_FLOWS: 60_000,   // 1min — expensive query
  LENDING: 60_000,       // 1min
  METRICS: 120_000,      // 2min — aggregated
  HEALTH: 15_000,        // 15s — quick check
} as const;

// ─── Provider health tracking ───────────────────────────────────

let envioHealthy = true;
let lastEnvioCheck = 0;
const HEALTH_CHECK_INTERVAL = 60_000; // Re-check every 60s

async function isEnvioAvailable(): Promise<boolean> {
  // Quick circuit breaker — don't re-check too often
  if (Date.now() - lastEnvioCheck < HEALTH_CHECK_INTERVAL) {
    return envioHealthy;
  }

  // Check if API token is configured
  if (!process.env.ENVIO_API_TOKEN) {
    envioHealthy = false;
    lastEnvioCheck = Date.now();
    return false;
  }

  try {
    const health = await envio.checkHealth();
    const wasHealthy = envioHealthy;
    envioHealthy = health.healthy;
    lastEnvioCheck = Date.now();
    if (!health.healthy) {
      logger.warn("Envio HyperSync unhealthy, using fallback", {
        latencyMs: health.latencyMs,
      });
      monitor.trackDataSourceFailure("envio", new Error("Health check failed"), { latencyMs: health.latencyMs });
    } else if (!wasHealthy && health.healthy) {
      // Recovery detected
      monitor.trackDataSourceRecovery("envio-hypersync", HEALTH_CHECK_INTERVAL);
    }
    return health.healthy;
  } catch {
    envioHealthy = false;
    lastEnvioCheck = Date.now();
    return false;
  }
}

// ─── Generic fallback wrapper ───────────────────────────────────

async function withFallback<T>(
  label: string,
  primary: () => Promise<T>,
  secondary: () => Promise<T>
): Promise<{ data: T; source: string }> {
  const end = timing(`indexer.${label}`);

  // Try primary (Envio)
  if (await isEnvioAvailable()) {
    try {
      const data = await primary();
      const latencyMs = end();
      monitor.trackLatency(`indexer.${label}`, latencyMs, { provider: "envio" });
      return { data, source: "envio-hypersync" };
    } catch (err) {
      logger.warn(`Envio ${label} failed, falling back`, {
        error: err instanceof Error ? err.message : "unknown",
      });
      monitor.trackDataSourceFailure("envio", err, { operation: label });
      monitor.trackProviderSwitch("envio-hypersync", "etherscan-fallback", err instanceof Error ? err.message : "unknown");
      // Mark unhealthy for circuit breaker
      envioHealthy = false;
    }
  }

  // Fallback (Etherscan + DefiLlama)
  try {
    const data = await secondary();
    const latencyMs = end();
    monitor.trackLatency(`indexer.${label}`, latencyMs, { provider: "etherscan-fallback" });
    return { data, source: "etherscan-fallback" };
  } catch (err) {
    end();
    monitor.trackDataSourceFailure("etherscan", err, { operation: label });
    logger.error(`Both providers failed for ${label}`, {
      error: err instanceof Error ? err.message : "unknown",
    });
    throw new Error(`All indexer providers failed for ${label}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get recent large swaps across Aerodrome + Uniswap V3 on Base.
 */
export async function getLargeSwaps(query: SwapQuery = {}): Promise<{
  swaps: SwapEvent[];
  source: string;
  timestamp: number;
}> {
  const cacheKey = `idx:swaps:${query.protocol || "all"}:${query.minAmountUSD || 0}`;
  const ttlSec = Math.round(CACHE_TTL.SWAPS / 1000);

  const cached = await cache.get<{ swaps: SwapEvent[]; source: string; timestamp: number }>(cacheKey);
  if (cached) return cached;

  const { data, source } = await withFallback(
    "swaps",
    () => envio.getSwaps(query),
    () => fallback.getSwaps(query)
  );

  const result = { swaps: data, source, timestamp: Date.now() };
  await cache.set(cacheKey, result, ttlSec);
  return result;
}

/**
 * Get whale-sized flows (swaps, lending, transfers) above threshold.
 */
export async function getWhaleFlows(query: WhaleQuery = {}): Promise<{
  flows: WhaleFlow[];
  source: string;
  timestamp: number;
  summary: {
    totalVolumeUSD: number;
    largestFlowUSD: number;
    netFlowUSD: number;
    byType: Record<string, number>;
  };
}> {
  const minUSD = query.minAmountUSD || 50_000;
  const cacheKey = `idx:whales:${minUSD}`;
  const ttlSec = Math.round(CACHE_TTL.WHALE_FLOWS / 1000);

  const cached = await cache.get<ReturnType<typeof getWhaleFlows> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  const { data, source } = await withFallback(
    "whaleFlows",
    () => envio.getWhaleFlows(query),
    () => fallback.getWhaleFlows(query)
  );

  const summary = {
    totalVolumeUSD: data.reduce((s, f) => s + f.amountUSD, 0),
    largestFlowUSD: data.length > 0 ? Math.max(...data.map((f) => f.amountUSD)) : 0,
    netFlowUSD: data.reduce((s, f) => {
      if (f.type === "deposit" || f.type === "liquidity_add") return s + f.amountUSD;
      if (f.type === "withdraw" || f.type === "liquidity_remove") return s - f.amountUSD;
      return s;
    }, 0),
    byType: data.reduce(
      (acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  const result = { flows: data, source, timestamp: Date.now(), summary };
  await cache.set(cacheKey, result, ttlSec);
  return result;
}

/**
 * Get lending protocol events (Seamless, Aave V3 forks).
 */
export async function getLendingActivity(query: LendingQuery = {}): Promise<{
  events: LendingEvent[];
  source: string;
  timestamp: number;
  summary: {
    totalDepositsUSD: number;
    totalBorrowsUSD: number;
    totalLiquidationsUSD: number;
    netFlowUSD: number;
  };
}> {
  const cacheKey = `idx:lending:${query.protocol || "all"}:${query.action || "all"}`;
  const ttlSec = Math.round(CACHE_TTL.LENDING / 1000);

  const cached = await cache.get<ReturnType<typeof getLendingActivity> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  const { data, source } = await withFallback(
    "lending",
    () => envio.getLendingEvents(query),
    () => fallback.getLendingEvents(query)
  );

  const summary = {
    totalDepositsUSD: data
      .filter((e) => e.action === "deposit")
      .reduce((s, e) => s + e.amountUSD, 0),
    totalBorrowsUSD: data
      .filter((e) => e.action === "borrow")
      .reduce((s, e) => s + e.amountUSD, 0),
    totalLiquidationsUSD: data
      .filter((e) => e.action === "liquidation")
      .reduce((s, e) => s + e.amountUSD, 0),
    netFlowUSD: data.reduce((s, e) => {
      if (e.action === "deposit" || e.action === "repay") return s + e.amountUSD;
      if (e.action === "withdraw" || e.action === "borrow") return s - e.amountUSD;
      return s;
    }, 0),
  };

  const result = { events: data, source, timestamp: Date.now(), summary };
  await cache.set(cacheKey, result, ttlSec);
  return result;
}

/**
 * Get aggregated protocol metrics for risk scoring enrichment.
 */
export async function getProtocolEvents(protocol: string): Promise<ProtocolMetrics> {
  const cacheKey = `idx:metrics:${protocol}`;
  const ttlSec = Math.round(CACHE_TTL.METRICS / 1000);

  const cached = await cache.get<ProtocolMetrics>(cacheKey);
  if (cached) return cached;

  // Fetch swaps for the specific protocol
  const protocolMap: Record<string, SwapEvent["protocol"]> = {
    aerodrome: "aerodrome",
    "uniswap-v3": "uniswap-v3",
    "uniswap-v4": "uniswap-v4",
  };
  const protocolKey = protocolMap[protocol.toLowerCase()];

  let swaps: SwapEvent[] = [];
  let whaleFlows: WhaleFlow[] = [];

  try {
    const swapResult = await getLargeSwaps({
      protocol: protocolKey,
      minAmountUSD: 100,
      limit: 200,
    });
    swaps = swapResult.swaps;
  } catch {}

  try {
    const whaleResult = await getWhaleFlows({
      protocol: protocol.toLowerCase(),
      minAmountUSD: 10_000,
      limit: 100,
    });
    whaleFlows = whaleResult.flows;
  } catch {}

  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86_400;

  const recentSwaps = swaps.filter((s) => s.timestamp >= oneDayAgo);
  const uniqueTraders = new Set(recentSwaps.map((s) => s.sender));

  const metrics: ProtocolMetrics = {
    protocol,
    swapVolume24h: recentSwaps.reduce((s, sw) => s + sw.amountUSD, 0),
    swapCount24h: recentSwaps.length,
    uniqueTraders24h: uniqueTraders.size,
    tvl: 0, // Populated by protocol-aggregator from DefiLlama
    largestSwap24h: recentSwaps.length > 0 ? Math.max(...recentSwaps.map((s) => s.amountUSD)) : 0,
    fees24h: recentSwaps.reduce((s, sw) => s + sw.amountUSD * 0.003, 0), // ~0.3% fee estimate
    netFlow24h: whaleFlows
      .filter((f) => f.timestamp >= oneDayAgo)
      .reduce((s, f) => {
        if (f.type === "deposit" || f.type === "liquidity_add") return s + f.amountUSD;
        if (f.type === "withdraw" || f.type === "liquidity_remove") return s - f.amountUSD;
        return s;
      }, 0),
  };

  await cache.set(cacheKey, metrics, ttlSec);
  return metrics;
}

/**
 * Health check for the indexer layer — checks both providers.
 */
export async function getIndexerHealth(): Promise<{
  primary: IndexerHealthStatus;
  fallback: IndexerHealthStatus;
  activeProvider: string;
}> {
  const cacheKey = "idx:health";
  const ttlSec = Math.round(CACHE_TTL.HEALTH / 1000);

  const cached = await cache.get<{
    primary: IndexerHealthStatus;
    fallback: IndexerHealthStatus;
    activeProvider: string;
  }>(cacheKey);
  if (cached) return cached;

  const [primary, fb] = await Promise.allSettled([
    envio.checkHealth(),
    fallback.checkHealth(),
  ]);

  const result = {
    primary:
      primary.status === "fulfilled"
        ? primary.value
        : {
            provider: "envio-hypersync",
            healthy: false,
            latencyMs: 0,
            lastBlock: 0,
            chainHead: 0,
            lag: 0,
            lastChecked: Date.now(),
          },
    fallback:
      fb.status === "fulfilled"
        ? fb.value
        : {
            provider: "etherscan-fallback",
            healthy: false,
            latencyMs: 0,
            lastBlock: 0,
            chainHead: 0,
            lag: 0,
            lastChecked: Date.now(),
          },
    activeProvider: envioHealthy ? "envio-hypersync" : "etherscan-fallback",
  };

  await cache.set(cacheKey, result, ttlSec);
  return result;
}

// Re-export types for convenience
export type {
  SwapEvent,
  WhaleFlow,
  LendingEvent,
  ProtocolMetrics,
  IndexerHealthStatus,
  SwapQuery,
  WhaleQuery,
  LendingQuery,
} from "./types";
