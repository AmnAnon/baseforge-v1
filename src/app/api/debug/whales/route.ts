// src/app/api/debug/whales/route.ts
// Debug endpoint for whale data pipeline diagnostics.
// Returns raw data from each stage of the pipeline for troubleshooting.
// NOTE: Only available in development or when DEBUG_MODE=true.

import { NextResponse } from "next/server";
import { getLargeSwaps, getIndexerHealth } from "@/lib/data/indexers";
import { circuitBreakers } from "@/lib/circuit-breaker";

const isDebug = process.env.DEBUG_MODE === "true" || process.env.NODE_ENV === "development";

export async function GET(req: Request) {
  if (!isDebug) {
    return NextResponse.json({ error: "Debug mode disabled. Set DEBUG_MODE=true to enable." }, { status: 403 });
  }

  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      ENVIO_API_TOKEN_SET: !!process.env.ENVIO_API_TOKEN,
      ENVIO_API_TOKEN_LENGTH: process.env.ENVIO_API_TOKEN?.length ?? 0,
      ETHERSCAN_API_KEY_SET: !!process.env.ETHERSCAN_API_KEY,
      CACHE_BACKEND: process.env.CACHE_BACKEND || "memory",
      WHALE_MIN_USD: process.env.WHALE_MIN_USD || "10000",
      WHALE_LIMIT: process.env.WHALE_LIMIT || "50",
    },
  };

  // 1. Indexer health
  try {
    const health = await getIndexerHealth();
    debug.health = health;
  } catch (err) {
    debug.health = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 2. Circuit breaker status
  const cbStatus: Record<string, unknown> = {};
  for (const [name, cb] of Object.entries(circuitBreakers)) {
    cbStatus[name] = cb.metricsSnapshot;
  }
  debug.circuitBreakers = cbStatus;

  // 3. Raw swap data from indexer
  try {
    const result = await getLargeSwaps({ minAmountUSD: 1000, limit: 200 });
    debug.rawSwaps = {
      count: result.swaps.length,
      source: result.source,
      timestamp: result.timestamp,
      sampleSwaps: result.swaps.slice(0, 3).map((s) => ({
        txHash: s.txHash,
        blockNumber: s.blockNumber,
        amountUSD: s.amountUSD,
        protocol: s.protocol,
        sender: s.sender,
      })),
    };
  } catch (err) {
    debug.rawSwaps = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 4. Envio direct query test
  try {
    if (process.env.ENVIO_API_TOKEN) {
      const envioRes = await fetch("https://base.hypersync.xyz/height", {
        headers: { Authorization: `Bearer ${process.env.ENVIO_API_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
      const envioData = await envioRes.json();
      debug.envioDirect = {
        status: envioRes.status,
        height: envioData.height ?? "unknown",
      };
    } else {
      debug.envioDirect = { skipped: "ENVIO_API_TOKEN not set" };
    }
  } catch (err) {
    debug.envioDirect = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 5. Etherscan direct query test
  try {
    if (process.env.ETHERSCAN_API_KEY) {
      const ethRes = await fetch(
        `https://api.etherscan.io/v2/api?chainid=8453&module=proxy&action=eth_blockNumber&apikey=${process.env.ETHERSCAN_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const ethData = await ethRes.json();
      debug.etherscanDirect = {
        status: ethRes.status,
        result: ethData.result ?? "unknown",
      };
    } else {
      debug.etherscanDirect = { skipped: "ETHERSCAN_API_KEY not set" };
    }
  } catch (err) {
    debug.etherscanDirect = { error: err instanceof Error ? err.message : "unknown" };
  }

  return NextResponse.json(debug, {
    headers: { "Cache-Control": "no-store" },
  });
}

export const dynamic = "force-dynamic";
