// src/lib/data/indexers/envio-provider.ts
// Envio HyperSync provider — primary indexer for Base chain.
//
// Why Envio HyperSync?
// - 2000x faster than RPC for historical data queries
// - Rust-based engine with ~25,000 events/sec throughput
// - Native Base chain support (base.hypersync.xyz)
// - TypeScript-first SDK with full type inference
// - Real-time indexing with sub-second latency
// - Independent benchmarks (May 2025): 15x faster than Subsquid,
//   142x faster than The Graph for Uniswap V2 Factory indexing
//
// HyperSync replaces our Etherscan V2 polling approach with direct
// event log queries — no API key rate limits, no 5-tx-per-page pagination.
//
// Requires: ENVIO_API_TOKEN env var (get from https://envio.dev)

import { logger } from "@/lib/logger";
import { circuitBreakers } from "@/lib/circuit-breaker";
import { CONTRACTS, EVENT_SIGNATURES, TOKEN_SYMBOLS, TOKEN_DECIMALS } from "./contracts";
import type {
  SwapEvent,
  LiquidityEvent,
  WhaleFlow,
  LendingEvent,
  IndexerHealthStatus,
  SwapQuery,
  WhaleQuery,
  LendingQuery,
} from "./types";

// ─── Config ─────────────────────────────────────────────────────

const HYPERSYNC_BASE_URL = "https://base.hypersync.xyz";
const API_TOKEN = () => process.env.ENVIO_API_TOKEN || "";
const REQUEST_TIMEOUT_MS = 15_000;

// ─── Raw HyperSync response types ──────────────────────────────

interface HyperSyncLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

interface HyperSyncBlock {
  number: number;
  timestamp: number;
  hash: string;
}

interface HyperSyncResponse {
  data: {
    logs: HyperSyncLog[];
    blocks: HyperSyncBlock[];
  };
  nextBlock: number;
  totalExecutionTime: number;
}

// ─── Low-level HyperSync query ──────────────────────────────────

/**
 * Retry a fetch with exponential backoff + jitter.
 * 3 retries: 1s → 2s → 4s (with ±30% jitter)
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;

      // Non-retryable errors (4xx except 429/503)
      if (res.status < 500 && res.status !== 429 && res.status !== 503) {
        const text = await res.text().catch(() => "unknown");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < maxRetries) {
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      const jitter = delay * 0.3 * (Math.random() * 2 - 1);
      const waitMs = Math.round(delay + jitter);
      logger.debug(`Envio retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`, {
        error: lastError.message,
      });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError ?? new Error("Unknown fetch error");
}

async function queryHyperSync(params: {
  fromBlock: number;
  toBlock?: number;
  addresses?: string[];
  topics: string[][];
  maxBlocks?: number;
}): Promise<HyperSyncResponse> {
  const token = API_TOKEN();

  const query = {
    from_block: params.fromBlock,
    ...(params.toBlock ? { to_block: params.toBlock } : {}),
    logs: [
      {
        ...(params.addresses?.length ? { address: params.addresses } : {}),
        topics: params.topics,
      },
    ],
    field_selection: {
      log: [
        "address",
        "topic0",
        "topic1",
        "topic2",
        "topic3",
        "data",
        "block_number",
        "transaction_hash",
        "log_index",
      ],
      block: ["number", "timestamp", "hash"],
    },
    ...(params.maxBlocks ? { max_num_blocks: params.maxBlocks } : {}),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Execute through circuit breaker + retry wrapper
  const res = await circuitBreakers.envio.execute(() =>
    fetchWithRetry(`${HYPERSYNC_BASE_URL}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`HyperSync query failed: ${res.status} — ${text}`);
  }

  const raw = await res.json();

  // Normalize field naming (HyperSync uses snake_case)
  const logs: HyperSyncLog[] = (raw.data?.logs || []).map(
    (l: Record<string, unknown>) => ({
      address: (l.address as string) || "",
      topics: [l.topic0, l.topic1, l.topic2, l.topic3].filter(Boolean) as string[],
      data: (l.data as string) || "0x",
      blockNumber: (l.block_number as number) || 0,
      transactionHash: (l.transaction_hash as string) || "",
      logIndex: (l.log_index as number) || 0,
    })
  );

  const blocks: HyperSyncBlock[] = (raw.data?.blocks || []).map(
    (b: Record<string, unknown>) => ({
      number: (b.number as number) || 0,
      timestamp: (b.timestamp as number) || 0,
      hash: (b.hash as string) || "",
    })
  );

  return {
    data: { logs, blocks },
    nextBlock: raw.next_block || raw.nextBlock || 0,
    totalExecutionTime: raw.total_execution_time || 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function blockTimestamp(blocks: HyperSyncBlock[], blockNumber: number): number {
  const block = blocks.find((b) => b.number === blockNumber);
  return block?.timestamp || Math.floor(Date.now() / 1000);
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function formatTokenAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6);
  return `${whole}.${fracStr}`;
}

function extractAddress(topic: string): string {
  if (!topic) return "0x0000000000000000000000000000000000000000";
  return "0x" + topic.slice(-40);
}

async function getEthPriceUSD(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(5_000) }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.ethereum?.usd || 2500;
    }
  } catch {}
  return 2500;
}

function estimateUSD(
  tokenAddress: string,
  rawAmount: bigint,
  ethPriceUSD: number
): number {
  const addr = tokenAddress.toLowerCase();
  const decimals = TOKEN_DECIMALS[addr] || 18;
  const amount = Number(rawAmount) / 10 ** decimals;

  // Stablecoins
  if (
    addr === CONTRACTS.USDC.toLowerCase() ||
    addr === CONTRACTS.USDbC.toLowerCase() ||
    addr === CONTRACTS.DAI.toLowerCase()
  ) {
    return amount;
  }
  // ETH/WETH
  if (addr === CONTRACTS.WETH.toLowerCase() || addr === CONTRACTS.cbETH.toLowerCase()) {
    return amount * ethPriceUSD;
  }
  // AERO — rough estimate
  if (addr === CONTRACTS.AERO.toLowerCase()) {
    return amount * 1.5; // Approximate, updated via cache in production
  }
  // Unknown tokens — assume $1 per unit (conservative)
  return amount;
}

async function getLatestBlock(): Promise<number> {
  try {
    const res = await fetch("https://base.hypersync.xyz/height", {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.height || data;
    }
  } catch {}
  return 0;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Fetch recent swap events from Aerodrome and Uniswap V3 on Base.
 */
export async function getSwaps(query: SwapQuery = {}): Promise<SwapEvent[]> {
  const { limit = 50, minAmountUSD = 0 } = query;
  const ethPrice = await getEthPriceUSD();
  const latestBlock = await getLatestBlock();
  const fromBlock = query.fromBlock || Math.max(0, latestBlock - 2000); // ~1hr of blocks

  const topics: string[][] = [];

  if (!query.protocol || query.protocol === "aerodrome") {
    topics.push([EVENT_SIGNATURES.AERODROME_SWAP]);
  }
  if (!query.protocol || query.protocol === "uniswap-v3") {
    topics.push([EVENT_SIGNATURES.UNISWAP_V3_SWAP]);
  }

  // Merge into a single OR query via topic0 array
  const allTopic0s = topics.map((t) => t[0]);

  const response = await queryHyperSync({
    fromBlock,
    topics: [allTopic0s],
    maxBlocks: 5000,
  });

  const swaps: SwapEvent[] = [];

  for (const log of response.data.logs) {
    const ts = blockTimestamp(response.data.blocks, log.blockNumber);
    const topic0 = log.topics[0];
    const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;

    try {
      if (topic0 === EVENT_SIGNATURES.UNISWAP_V3_SWAP) {
        // Uniswap V3 Swap(address sender, address recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
        const sender = extractAddress(log.topics[1]);
        const recipient = extractAddress(log.topics[2]);

        // Data: amount0 (int256), amount1 (int256), sqrtPriceX96, liquidity, tick
        const amount0Raw = decodeUint256("0x" + data.slice(0, 64));
        const amount1Raw = decodeUint256("0x" + data.slice(64, 128));

        const usdEst =
          estimateUSD(CONTRACTS.WETH, amount0Raw > 0n ? amount0Raw : -amount0Raw, ethPrice) +
          estimateUSD(CONTRACTS.USDC, amount1Raw > 0n ? amount1Raw : -amount1Raw, ethPrice);

        if (usdEst >= minAmountUSD) {
          swaps.push({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "uniswap-v3",
            pool: log.address,
            sender,
            recipient,
            tokenIn: amount0Raw > 0n ? "token0" : "token1",
            tokenOut: amount0Raw > 0n ? "token1" : "token0",
            amountIn: amount0Raw.toString(),
            amountOut: amount1Raw.toString(),
            amountUSD: Math.round(usdEst),
          });
        }
      } else if (topic0 === EVENT_SIGNATURES.AERODROME_SWAP) {
        // Aerodrome Swap(address sender, address to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)
        const sender = extractAddress(log.topics[1]);
        const to = extractAddress(log.topics[2]);

        const a0In = decodeUint256("0x" + data.slice(0, 64));
        const a1In = decodeUint256("0x" + data.slice(64, 128));
        const a0Out = decodeUint256("0x" + data.slice(128, 192));
        const a1Out = decodeUint256("0x" + data.slice(192, 256));

        const inUSD =
          estimateUSD(CONTRACTS.WETH, a0In, ethPrice) +
          estimateUSD(CONTRACTS.USDC, a1In, ethPrice);
        const outUSD =
          estimateUSD(CONTRACTS.WETH, a0Out, ethPrice) +
          estimateUSD(CONTRACTS.USDC, a1Out, ethPrice);
        const usdEst = Math.max(inUSD, outUSD);

        if (usdEst >= minAmountUSD) {
          swaps.push({
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "aerodrome",
            pool: log.address,
            sender,
            recipient: to,
            tokenIn: a0In > 0n ? "token0" : "token1",
            tokenOut: a0Out > 0n ? "token0" : "token1",
            amountIn: (a0In + a1In).toString(),
            amountOut: (a0Out + a1Out).toString(),
            amountUSD: Math.round(usdEst),
          });
        }
      }
    } catch (err) {
      logger.debug("Failed to decode swap log", {
        tx: log.transactionHash,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // Sort by most recent first
  swaps.sort((a, b) => b.blockNumber - a.blockNumber);
  return swaps.slice(0, limit);
}

/**
 * Fetch whale-sized flows across DEXes and lending protocols.
 */
export async function getWhaleFlows(query: WhaleQuery = {}): Promise<WhaleFlow[]> {
  const { limit = 50, minAmountUSD = 50_000 } = query;
  const ethPrice = await getEthPriceUSD();
  const latestBlock = await getLatestBlock();
  const fromBlock = query.fromBlock || Math.max(0, latestBlock - 5000);

  // Query all major event types
  const topic0s = [
    EVENT_SIGNATURES.UNISWAP_V3_SWAP,
    EVENT_SIGNATURES.AERODROME_SWAP,
    EVENT_SIGNATURES.AAVE_SUPPLY,
    EVENT_SIGNATURES.AAVE_WITHDRAW,
    EVENT_SIGNATURES.AAVE_BORROW,
    EVENT_SIGNATURES.AAVE_REPAY,
    EVENT_SIGNATURES.AAVE_LIQUIDATION,
  ];

  const response = await queryHyperSync({
    fromBlock,
    topics: [topic0s],
    maxBlocks: 10000,
  });

  const flows: WhaleFlow[] = [];

  for (const log of response.data.logs) {
    const ts = blockTimestamp(response.data.blocks, log.blockNumber);
    const topic0 = log.topics[0];
    const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;

    try {
      let flow: WhaleFlow | null = null;

      // ── DEX swaps ──
      if (topic0 === EVENT_SIGNATURES.UNISWAP_V3_SWAP) {
        const sender = extractAddress(log.topics[1]);
        const recipient = extractAddress(log.topics[2]);
        const amount0Raw = decodeUint256("0x" + data.slice(0, 64));
        const usdEst = estimateUSD(CONTRACTS.WETH, amount0Raw > 0n ? amount0Raw : -amount0Raw, ethPrice);

        if (usdEst >= minAmountUSD) {
          flow = {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "uniswap-v3",
            type: "swap",
            from: sender,
            to: recipient,
            amountUSD: Math.round(usdEst),
            token: "WETH",
            tokenAmount: formatTokenAmount(amount0Raw > 0n ? amount0Raw : -amount0Raw, 18),
          };
        }
      } else if (topic0 === EVENT_SIGNATURES.AERODROME_SWAP) {
        const sender = extractAddress(log.topics[1]);
        const to = extractAddress(log.topics[2]);
        const a0In = decodeUint256("0x" + data.slice(0, 64));
        const a1In = decodeUint256("0x" + data.slice(64, 128));
        const inUSD =
          estimateUSD(CONTRACTS.WETH, a0In, ethPrice) +
          estimateUSD(CONTRACTS.USDC, a1In, ethPrice);

        if (inUSD >= minAmountUSD) {
          flow = {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "aerodrome",
            type: "swap",
            from: sender,
            to,
            amountUSD: Math.round(inUSD),
            token: a0In > 0n ? "WETH" : "USDC",
            tokenAmount: formatTokenAmount(a0In > 0n ? a0In : a1In, a0In > 0n ? 18 : 6),
          };
        }
      }

      // ── Lending events (Seamless / Aave V3) ──
      else if (topic0 === EVENT_SIGNATURES.AAVE_SUPPLY) {
        const asset = extractAddress(log.topics[1]);
        const user = extractAddress(log.topics[2]);
        const amount = decodeUint256("0x" + data.slice(0, 64));
        const decimals = TOKEN_DECIMALS[asset.toLowerCase()] || 18;
        const usdEst = estimateUSD(asset, amount, ethPrice);

        if (usdEst >= minAmountUSD) {
          flow = {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "seamless",
            type: "deposit",
            from: user,
            to: log.address,
            amountUSD: Math.round(usdEst),
            token: TOKEN_SYMBOLS[asset.toLowerCase()] || "UNKNOWN",
            tokenAmount: formatTokenAmount(amount, decimals),
          };
        }
      } else if (topic0 === EVENT_SIGNATURES.AAVE_WITHDRAW) {
        const asset = extractAddress(log.topics[1]);
        const user = extractAddress(log.topics[2]);
        const amount = decodeUint256("0x" + data.slice(0, 64));
        const usdEst = estimateUSD(asset, amount, ethPrice);

        if (usdEst >= minAmountUSD) {
          flow = {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "seamless",
            type: "withdraw",
            from: log.address,
            to: user,
            amountUSD: Math.round(usdEst),
            token: TOKEN_SYMBOLS[asset.toLowerCase()] || "UNKNOWN",
            tokenAmount: formatTokenAmount(amount, TOKEN_DECIMALS[asset.toLowerCase()] || 18),
          };
        }
      } else if (topic0 === EVENT_SIGNATURES.AAVE_BORROW) {
        const asset = extractAddress(log.topics[1]);
        const user = extractAddress(log.topics[2]);
        const amount = decodeUint256("0x" + data.slice(0, 64));
        const usdEst = estimateUSD(asset, amount, ethPrice);

        if (usdEst >= minAmountUSD) {
          flow = {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "seamless",
            type: "borrow",
            from: log.address,
            to: user,
            amountUSD: Math.round(usdEst),
            token: TOKEN_SYMBOLS[asset.toLowerCase()] || "UNKNOWN",
            tokenAmount: formatTokenAmount(amount, TOKEN_DECIMALS[asset.toLowerCase()] || 18),
          };
        }
      } else if (topic0 === EVENT_SIGNATURES.AAVE_LIQUIDATION) {
        const collateral = extractAddress(log.topics[1]);
        const debt = extractAddress(log.topics[2]);
        const user = extractAddress(log.topics[3]);
        const debtAmount = decodeUint256("0x" + data.slice(0, 64));
        const usdEst = estimateUSD(debt, debtAmount, ethPrice);

        if (usdEst >= minAmountUSD) {
          flow = {
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: ts,
            protocol: "seamless",
            type: "withdraw", // liquidation modeled as forced withdrawal
            from: user,
            to: "liquidator",
            amountUSD: Math.round(usdEst),
            token: TOKEN_SYMBOLS[debt.toLowerCase()] || "UNKNOWN",
            tokenAmount: formatTokenAmount(debtAmount, TOKEN_DECIMALS[debt.toLowerCase()] || 18),
          };
        }
      }

      if (flow) flows.push(flow);
    } catch (err) {
      logger.debug("Failed to decode whale flow log", {
        tx: log.transactionHash,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  flows.sort((a, b) => b.amountUSD - a.amountUSD);
  return flows.slice(0, limit);
}

/**
 * Fetch lending protocol events from Seamless (Aave V3 fork).
 */
export async function getLendingEvents(query: LendingQuery = {}): Promise<LendingEvent[]> {
  const { limit = 50, minAmountUSD = 0 } = query;
  const ethPrice = await getEthPriceUSD();
  const latestBlock = await getLatestBlock();
  const fromBlock = query.fromBlock || Math.max(0, latestBlock - 5000);

  const topic0s = [
    EVENT_SIGNATURES.AAVE_SUPPLY,
    EVENT_SIGNATURES.AAVE_WITHDRAW,
    EVENT_SIGNATURES.AAVE_BORROW,
    EVENT_SIGNATURES.AAVE_REPAY,
    EVENT_SIGNATURES.AAVE_LIQUIDATION,
  ];

  const response = await queryHyperSync({
    fromBlock,
    addresses: [CONTRACTS.SEAMLESS_POOL],
    topics: [topic0s],
    maxBlocks: 10000,
  });

  const events: LendingEvent[] = [];

  for (const log of response.data.logs) {
    const ts = blockTimestamp(response.data.blocks, log.blockNumber);
    const topic0 = log.topics[0];
    const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;

    try {
      const actionMap: Record<string, LendingEvent["action"]> = {
        [EVENT_SIGNATURES.AAVE_SUPPLY]: "deposit",
        [EVENT_SIGNATURES.AAVE_WITHDRAW]: "withdraw",
        [EVENT_SIGNATURES.AAVE_BORROW]: "borrow",
        [EVENT_SIGNATURES.AAVE_REPAY]: "repay",
        [EVENT_SIGNATURES.AAVE_LIQUIDATION]: "liquidation",
      };

      const action = actionMap[topic0];
      if (!action) continue;

      const asset = extractAddress(log.topics[1]);
      const user = extractAddress(log.topics[2]);
      const amount = decodeUint256("0x" + data.slice(0, 64));
      const decimals = TOKEN_DECIMALS[asset.toLowerCase()] || 18;
      const usdEst = estimateUSD(asset, amount, ethPrice);

      if (usdEst < minAmountUSD) continue;
      if (query.action && query.action !== action) continue;
      if (query.user && query.user.toLowerCase() !== user.toLowerCase()) continue;

      events.push({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: ts,
        protocol: "seamless",
        action,
        user,
        asset,
        amount: formatTokenAmount(amount, decimals),
        amountUSD: Math.round(usdEst),
        onBehalfOf: log.topics[3] ? extractAddress(log.topics[3]) : undefined,
      });
    } catch (err) {
      logger.debug("Failed to decode lending log", {
        tx: log.transactionHash,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  events.sort((a, b) => b.blockNumber - a.blockNumber);
  return events.slice(0, limit);
}

/**
 * Check Envio HyperSync health and latency.
 */
export async function checkHealth(): Promise<IndexerHealthStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${HYPERSYNC_BASE_URL}/height`, {
      signal: AbortSignal.timeout(5_000),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        provider: "envio-hypersync",
        healthy: false,
        latencyMs,
        lastBlock: 0,
        chainHead: 0,
        lag: 0,
        lastChecked: Date.now(),
      };
    }

    const data = await res.json();
    const height = typeof data === "number" ? data : data.height || 0;

    return {
      provider: "envio-hypersync",
      healthy: true,
      latencyMs,
      lastBlock: height,
      chainHead: height, // HyperSync tracks chain head
      lag: 0,
      lastChecked: Date.now(),
    };
  } catch {
    return {
      provider: "envio-hypersync",
      healthy: false,
      latencyMs: Date.now() - start,
      lastBlock: 0,
      chainHead: 0,
      lag: 0,
      lastChecked: Date.now(),
    };
  }
}
