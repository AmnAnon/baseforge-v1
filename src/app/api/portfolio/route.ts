// src/app/api/portfolio/route.ts
// Portfolio tracker — on-chain wallet balances via viem multicall + USD values via CoinGecko.
//
// SECURITY NOTES:
// - Read-only: this endpoint only fetches balances via public RPC calls
// - NEVER stores private keys, seed phrases, or signatures
// - NEVER signs transactions or initiates transfers
// - Wallet address is only used as a public query parameter
// - Rate limited to prevent abuse
//
// Replaces the old placeholder implementation with real Base chain data.
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { getWalletBalances } from "@/lib/viem/balances";

interface PortfolioPosition {
  symbol: string;
  priceUsd: number;
  balance: string;
  valueUsd: number;
  category: string;
}

interface PortfolioSummary {
  totalUsdValue: number;
  positionCount: number;
  nativeBalance: string;
  topToken: string | null;
}

interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
  timestamp: number;
}

const EMPTY_RESPONSE = {
  summary: { totalUsdValue: 0, positionCount: 0, nativeBalance: "0", topToken: null },
  positions: [] as PortfolioPosition[],
  timestamp: Date.now(),
  isStale: true,
};

// Simple price map from CoinGecko — single batch request
async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data) as [string, { usd: number } | never][]) {
      if (val && typeof val === "object" && "usd" in val) {
        prices[id] = val.usd;
      }
    }
    return prices;
  } catch {
    return {};
  }
}

const TOKEN_CATEGORY_MAP: Record<string, string> = {
  WETH: "Wrapped Native",
  USDC: "Stablecoin",
  USDbC: "Stablecoin",
  cbETH: "Liquid Staking",
  AERO: "DEX / AMM",
  DAI: "Stablecoin",
};

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const address = url.searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
    }

    if (!isAddress(address)) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }

    const checksumAddress = address.toLowerCase() as typeof address;
    const cacheKey = `portfolio-${checksumAddress}`;

    const data = await cache.getWithStaleFallback(cacheKey, CACHE_TTL.TVL_HISTORY, async () => {
      const balances = await getWalletBalances(address);

      // Gather all token IDs for a single CoinGecko price batch
      const allCoingeckoIds = balances.tokens.map((t) => t.coingeckoId);
      if (parseFloat(balances.native.formatted) > 0) {
        allCoingeckoIds.unshift("ethereum");
      }

      const prices = await fetchPrices(allCoingeckoIds);

      // Get native ETH price (defaults to 0 if fetch failed)
      const ethPrice = prices["ethereum"] ?? 0;

      // Build portfolio positions
      const positions: PortfolioPosition[] = [];

      if (ethPrice > 0 && parseFloat(balances.native.formatted) > 0) {
        const ethValue = parseFloat(balances.native.formatted) * ethPrice;
        positions.push({
          symbol: "ETH",
          priceUsd: ethPrice,
          balance: balances.native.formatted,
          valueUsd: ethValue,
          category: "Native",
        });
      }

      for (const token of balances.tokens) {
        const price = prices[token.coingeckoId] ?? 0;
        const value = parseFloat(token.formatted) * price;

        positions.push({
          symbol: token.symbol,
          priceUsd: price,
          balance: token.formatted,
          valueUsd: value,
          category: TOKEN_CATEGORY_MAP[token.symbol] ?? "Other",
        });
      }

      // Summary
      const totalUsdValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
      const topToken = positions.reduce(
        (top, p) => (p.valueUsd > top.valueUsd ? top : p),
        { valueUsd: 0, symbol: null } as { valueUsd: number; symbol: string | null }
      ).symbol;

      return {
        summary: {
          totalUsdValue,
          positionCount: positions.length,
          nativeBalance: balances.native.formatted,
          topToken,
        },
        positions,
        timestamp: Date.now(),
      };
    });

    const headers: Record<string, string> = (data as { isStale?: boolean }).isStale
      ? { "Cache-Control": "public, max-age=0, stale-while-revalidate=120", "X-Cache-Status": "STALE" }
      : { "Cache-Control": "public, max-age=60, stale-while-revalidate=120", "X-Cache-Status": "HIT" };

    return NextResponse.json(data, { status: 200, headers });
  } catch (err) {
    console.error("Portfolio API error:", err);
    return NextResponse.json(EMPTY_RESPONSE, { status: 500 });
  }
}
