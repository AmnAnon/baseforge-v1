// src/app/api/debug/portfolio/route.ts
// Debug endpoint for portfolio data pipeline diagnostics.
// Tests viem multicall, CoinGecko prices, and address validation.
// NOTE: Only available in development or when DEBUG_MODE=true.

import { NextResponse } from "next/server";
import { isAddress, erc20Abi, formatUnits, type Address } from "viem";
import { basePublicClient } from "@/lib/viem/client";
import { TRACKED_TOKENS } from "@/lib/viem/balances";

const isDebug = process.env.DEBUG_MODE === "true" || process.env.NODE_ENV === "development";

// Test wallet (known Base address with holdings)
const TEST_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;

export async function GET(req: Request) {
  if (!isDebug) {
    return NextResponse.json({ error: "Debug mode disabled. Set DEBUG_MODE=true to enable." }, { status: 403 });
  }

  const url = new URL(req.url);
  const testAddress = (url.searchParams.get("address") || TEST_WALLET) as Address;

  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    testAddress,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      CACHE_BACKEND: process.env.CACHE_BACKEND || "memory",
      TRACKED_TOKENS_COUNT: TRACKED_TOKENS.length,
    },
  };

  // 1. Address validation
  debug.addressValidation = {
    isValid: isAddress(testAddress),
    checksummed: testAddress,
  };

  // 2. viem multicall — raw balances
  try {
    const calls = TRACKED_TOKENS.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [testAddress] as const,
    }));

    const results = await basePublicClient.multicall({
      contracts: calls,
      allowFailure: true,
    });

    debug.multicall = {
      rpcTransport: "http",
      chainId: "base",
      callsSent: calls.length,
      resultsReceived: results.length,
      failures: results.filter((r) => r.status === "failure").length,
      tokensWithBalance: [] as Array<{ symbol: string; raw: string; formatted: string }>,
    };

    for (let i = 0; i < results.length; i++) {
      const token = TRACKED_TOKENS[i];
      const result = results[i];
      if (result.status === "success" && result.result > BigInt(0)) {
        const formatted = formatUnits(result.result, token.decimals);
        (debug.multicall as Record<string, unknown>).tokensWithBalance = [
          ...(debug.multicall as Record<string, unknown>).tokensWithBalance as Array<unknown>,
          { symbol: token.symbol, raw: result.result.toString(), formatted: parseFloat(formatted).toFixed(6) },
        ];
      }
    }
  } catch (err) {
    debug.multicall = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 3. Native ETH balance
  try {
    const ethBalance = await basePublicClient.getBalance({ address: testAddress });
    debug.ethBalance = {
      raw: ethBalance.toString(),
      formatted: formatUnits(ethBalance, 18),
    };
  } catch (err) {
    debug.ethBalance = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 4. CoinGecko price fetch
  try {
    const ids = TRACKED_TOKENS.map((t) => t.coingeckoId).concat("ethereum");
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    const priceData = await priceRes.json();
    debug.coinGecko = {
      status: priceRes.status,
      pricesFetched: Object.keys(priceData).length,
      samplePrices: {} as Record<string, number>,
    };
    for (const [id, data] of Object.entries(priceData) as [string, { usd?: number; usd_24h_change?: number }][]) {
      if (data?.usd !== undefined) {
        (debug.coinGecko as Record<string, unknown>).samplePrices = {
          ...((debug.coinGecko as Record<string, unknown>).samplePrices as Record<string, number>),
          [id]: data.usd,
        };
      }
    }
  } catch (err) {
    debug.coinGecko = { error: err instanceof Error ? err.message : "unknown" };
  }

  // 5. Full portfolio API call
  try {
    const portfolioRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/portfolio?address=${testAddress}`);
    const portfolioData = await portfolioRes.json();
    debug.portfolioApi = {
      status: portfolioRes.status,
      totalUsdValue: portfolioData.summary?.totalUsdValue ?? 0,
      positionCount: portfolioData.summary?.positionCount ?? 0,
      positions: portfolioData.positions?.slice(0, 3) ?? [],
    };
  } catch (err) {
    debug.portfolioApi = { error: err instanceof Error ? err.message : "unknown" };
  }

  return NextResponse.json(debug, {
    headers: { "Cache-Control": "no-store" },
  });
}

export const dynamic = "force-dynamic";
