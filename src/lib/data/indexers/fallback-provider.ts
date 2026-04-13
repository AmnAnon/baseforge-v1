// src/lib/data/indexers/fallback-provider.ts
// Fallback data provider — uses DefiLlama + Etherscan V2 (the original data path).
// Activated when Envio HyperSync is unavailable or unhealthy.
// Less granular but more reliable for basic metrics.

import { logger } from "@/lib/logger";
import { circuitBreakers } from "@/lib/circuit-breaker";
import { CONTRACTS, TOKEN_SYMBOLS, ADDRESS_LABELS } from "./contracts";
import type { SwapEvent, WhaleFlow, LendingEvent, IndexerHealthStatus, SwapQuery, WhaleQuery, LendingQuery } from "./types";

const ETHERSCAN_API_KEY = () => process.env.ETHERSCAN_API_KEY || "";
const BASE_CHAIN_ID = 8453;
const ETH_PRICE_FALLBACK = 2500;

// ─── Helpers ────────────────────────────────────────────────────

async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(5_000) }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.ethereum?.usd || ETH_PRICE_FALLBACK;
    }
  } catch {}
  return ETH_PRICE_FALLBACK;
}

function labelAddress(addr: string): string {
  return ADDRESS_LABELS[addr.toLowerCase()] || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function fetchEtherscanTxList(
  address: string,
  offset: number = 20
): Promise<Array<Record<string, string>>> {
  const apiKey = ETHERSCAN_API_KEY();
  if (!apiKey) return [];

  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${BASE_CHAIN_ID}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${offset}&sort=desc&apikey=${apiKey}`;
    const res = await circuitBreakers.etherscan.execute(() =>
      fetch(url, { signal: AbortSignal.timeout(10_000) })
    );
    const data = await res.json();
    if (data.status === "1" && Array.isArray(data.result)) {
      return data.result;
    }
  } catch (err) {
    logger.warn("Etherscan fallback fetch failed", {
      address,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
  return [];
}

// ─── Public API (matching envio-provider interface) ──────────────

export async function getSwaps(query: SwapQuery = {}): Promise<SwapEvent[]> {
  const { limit = 50, minAmountUSD = 0 } = query;
  const ethPrice = await getEthPrice();

  const addresses = [
    { addr: CONTRACTS.UNISWAP_V3_ROUTER, protocol: "uniswap-v3" as const },
    { addr: CONTRACTS.AERODROME_ROUTER, protocol: "aerodrome" as const },
  ];

  const allSwaps: SwapEvent[] = [];

  for (const { addr, protocol } of addresses) {
    if (query.protocol && query.protocol !== protocol) continue;

    const txList = await fetchEtherscanTxList(addr, 30);
    for (const tx of txList) {
      const ethValue = parseFloat(tx.value || "0") / 1e18;
      const usdValue = ethValue * ethPrice;
      if (usdValue < minAmountUSD) continue;

      allSwaps.push({
        txHash: tx.hash,
        blockNumber: parseInt(tx.blockNumber || "0"),
        timestamp: parseInt(tx.timeStamp || "0"),
        protocol,
        pool: addr,
        sender: tx.from,
        recipient: tx.to,
        tokenIn: "ETH",
        tokenOut: "UNKNOWN",
        amountIn: ethValue.toFixed(4),
        amountOut: "0",
        amountUSD: Math.round(usdValue),
      });
    }
  }

  allSwaps.sort((a, b) => b.blockNumber - a.blockNumber);
  return allSwaps.slice(0, limit);
}

export async function getWhaleFlows(query: WhaleQuery = {}): Promise<WhaleFlow[]> {
  const { limit = 50, minAmountUSD = 50_000 } = query;
  const ethPrice = await getEthPrice();

  const monitored = [
    { addr: CONTRACTS.UNISWAP_V3_ROUTER, protocol: "uniswap-v3" },
    { addr: CONTRACTS.AERODROME_ROUTER, protocol: "aerodrome" },
    { addr: CONTRACTS.SEAMLESS_POOL, protocol: "seamless" },
  ];

  const flows: WhaleFlow[] = [];

  for (const { addr, protocol } of monitored) {
    const txList = await fetchEtherscanTxList(addr, 30);
    for (const tx of txList) {
      const ethValue = parseFloat(tx.value || "0") / 1e18;
      const usdValue = ethValue * ethPrice;
      if (usdValue < minAmountUSD) continue;

      flows.push({
        txHash: tx.hash,
        blockNumber: parseInt(tx.blockNumber || "0"),
        timestamp: parseInt(tx.timeStamp || "0"),
        protocol,
        type: "swap",
        from: labelAddress(tx.from),
        to: labelAddress(tx.to),
        amountUSD: Math.round(usdValue),
        token: "ETH",
        tokenAmount: ethValue.toFixed(4),
      });
    }
  }

  // Deduplicate by tx hash
  const unique = Array.from(new Map(flows.map((f) => [f.txHash, f])).values());
  unique.sort((a, b) => b.amountUSD - a.amountUSD);
  return unique.slice(0, limit);
}

export async function getLendingEvents(query: LendingQuery = {}): Promise<LendingEvent[]> {
  const { limit = 50, minAmountUSD = 0 } = query;
  const ethPrice = await getEthPrice();

  const txList = await fetchEtherscanTxList(CONTRACTS.SEAMLESS_POOL, 30);
  const events: LendingEvent[] = [];

  for (const tx of txList) {
    const ethValue = parseFloat(tx.value || "0") / 1e18;
    const usdValue = ethValue * ethPrice;
    if (usdValue < minAmountUSD) continue;

    events.push({
      txHash: tx.hash,
      blockNumber: parseInt(tx.blockNumber || "0"),
      timestamp: parseInt(tx.timeStamp || "0"),
      protocol: "seamless",
      action: "deposit", // Can't distinguish from Etherscan basic tx list
      user: tx.from,
      asset: CONTRACTS.WETH,
      amount: ethValue.toFixed(4),
      amountUSD: Math.round(usdValue),
    });
  }

  events.sort((a, b) => b.blockNumber - a.blockNumber);
  return events.slice(0, limit);
}

export async function checkHealth(): Promise<IndexerHealthStatus> {
  const start = Date.now();
  const apiKey = ETHERSCAN_API_KEY();

  if (!apiKey) {
    return {
      provider: "etherscan-fallback",
      healthy: false,
      latencyMs: 0,
      lastBlock: 0,
      chainHead: 0,
      lag: 0,
      lastChecked: Date.now(),
    };
  }

  try {
    const res = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${BASE_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(5_000) }
    );
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      const blockHex = data.result || "0x0";
      const blockNumber = parseInt(blockHex, 16);
      return {
        provider: "etherscan-fallback",
        healthy: true,
        latencyMs,
        lastBlock: blockNumber,
        chainHead: blockNumber,
        lag: 0,
        lastChecked: Date.now(),
      };
    }
  } catch {}

  return {
    provider: "etherscan-fallback",
    healthy: false,
    latencyMs: Date.now() - start,
    lastBlock: 0,
    chainHead: 0,
    lag: 0,
    lastChecked: Date.now(),
  };
}
