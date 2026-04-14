// src/app/api/portfolio/route.ts
// Portfolio Intelligence — on-chain balances via viem multicall + USD values via CoinGecko.
//
// SECURITY NOTES:
// - Read-only: this endpoint only fetches balances via public RPC calls
// - NEVER stores private keys, seed phrases, or signatures
// - NEVER signs transactions or initiates transfers
// - Wallet address is only used as a public query parameter
// - Rate limited to prevent abuse
//
// Response fields:
//   summary: { totalUsdValue, positionCount, nativeBalance, topToken, stablecoinPct, ethDerivativePct, governancePct }
//   positions: [{ symbol, priceUsd, balance, valueUsd, category, change24h, coingeckoId }]
//   protocolExposure: [{ protocol: string, valueUsd: number, pct: number }]
//   riskFlags: { concentrationRisk: boolean, topAssetPct: number, stablecoinHeavy: boolean }
//   timestamp, isStale
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { getWalletBalances, TRACKED_TOKENS } from "@/lib/viem/balances";

interface PortfolioPosition {
  symbol: string;
  priceUsd: number;
  balance: string;
  valueUsd: number;
  category: string;
  change24h?: number;
  coingeckoId: string;
  allocationPct: number;
}

interface ProtocolExposure {
  protocol: string;
  valueUsd: number;
  pct: number;
}

interface PortfolioSummary {
  totalUsdValue: number;
  positionCount: number;
  nativeBalance: string;
  topToken: string | null;
  stablecoinPct: number;
  ethDerivativePct: number;
  governancePct: number;
}

interface RiskFlags {
  concentrationRisk: boolean;
  topAssetPct: number;
  stablecoinHeavy: boolean;
}

interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
  protocolExposure: ProtocolExposure[];
  riskFlags: RiskFlags;
  timestamp: number;
  isStale: boolean;
}

const EMPTY_RESPONSE: PortfolioResponse = {
  summary: { totalUsdValue: 0, positionCount: 0, nativeBalance: "0", topToken: null, stablecoinPct: 0, ethDerivativePct: 0, governancePct: 0 },
  positions: [],
  protocolExposure: [],
  riskFlags: { concentrationRisk: false, topAssetPct: 0, stablecoinHeavy: false },
  timestamp: Date.now(),
  isStale: true,
};

// Fetch prices + 24h change from CoinGecko
async function fetchPricesWithChange(ids: string[]): Promise<Record<string, { usd: number; change24h: number }>> {
  if (ids.length === 0) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const prices: Record<string, { usd: number; change24h: number }> = {};
    for (const [id, val] of Object.entries(data) as [string, { usd?: number; usd_24h_change?: number } | never][]) {
      if (val && typeof val === "object") {
        prices[id] = {
          usd: val.usd ?? 0,
          change24h: val.usd_24h_change ?? 0,
        };
      }
    }
    return prices;
  } catch {
    return {};
  }
}

// Map token categories to protocol exposures
function computeProtocolExposure(positions: PortfolioPosition[], totalUsd: number): ProtocolExposure[] {
  const protocolMap = new Map<string, number>();

  for (const p of positions) {
    // Map tokens to protocols
    const protocolMap_: Record<string, string> = {
      AERO: "Aerodrome",
      COMP: "Compound",
      WELL: "Moonwell",
      cbETH: "Coinbase",
      WSTETH: "Lido",
      LDO: "Lido",
      DEGEN: "Degen Ecosystem",
      BRETT: "Meme Ecosystem",
      VIRTUAL: "Virtual Protocol",
      TOSHI: "Toshi Ecosystem",
    };

    const proto = protocolMap_[p.symbol] || (p.category === "Stablecoin" ? "Stablecoins" : p.category);
    protocolMap.set(proto, (protocolMap.get(proto) || 0) + p.valueUsd);
  }

  return Array.from(protocolMap.entries())
    .map(([protocol, valueUsd]) => ({ protocol, valueUsd, pct: totalUsd > 0 ? (valueUsd / totalUsd) * 100 : 0 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

function computeRiskFlags(positions: PortfolioPosition[], totalUsd: number): RiskFlags {
  const topAsset = positions[0];
  const topAssetPct = totalUsd > 0 ? (topAsset?.valueUsd / totalUsd) * 100 : 0;
  const stablecoinTotal = positions.filter((p) => p.category === "Stablecoin").reduce((s, p) => s + p.valueUsd, 0);
  const stablecoinPct = totalUsd > 0 ? (stablecoinTotal / totalUsd) * 100 : 0;

  return {
    concentrationRisk: topAssetPct > 70,
    topAssetPct: Math.round(topAssetPct),
    stablecoinHeavy: stablecoinPct > 80,
  };
}

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
    const cacheKey = `portfolio-v2-${checksumAddress}`;

    const data = await cache.getWithStaleFallback(cacheKey, CACHE_TTL.TVL_HISTORY, async () => {
      const balances = await getWalletBalances(address);

      // Gather all CoinGecko IDs
      const allCoingeckoIds = balances.tokens.map((t) => t.coingeckoId);
      if (parseFloat(balances.native.formatted) > 0) {
        allCoingeckoIds.unshift("ethereum");
      }

      const prices = await fetchPricesWithChange(allCoingeckoIds);

      // Token category lookup
      const tokenCategoryMap = new Map(TRACKED_TOKENS.map((t) => [t.symbol, t.category]));

      // Build positions
      const positions: PortfolioPosition[] = [];

      if (parseFloat(balances.native.formatted) > 0) {
        const ethPrice = prices["ethereum"]?.usd ?? 0;
        const ethValue = parseFloat(balances.native.formatted) * ethPrice;
        positions.push({
          symbol: "ETH",
          priceUsd: ethPrice,
          balance: balances.native.formatted,
          valueUsd: ethValue,
          category: "ETH Derivative",
          change24h: prices["ethereum"]?.change24h,
          coingeckoId: "ethereum",
          allocationPct: 0, // computed below
        });
      }

      for (const token of balances.tokens) {
        const priceData = prices[token.coingeckoId];
        const price = priceData?.usd ?? 0;
        const value = parseFloat(token.formatted) * price;

        positions.push({
          symbol: token.symbol,
          priceUsd: price,
          balance: token.formatted,
          valueUsd: value,
          category: token.category === "stablecoin" ? "Stablecoin"
            : token.category === "eth-derivative" ? "ETH Derivative"
            : token.category === "governance" ? "Governance"
            : token.category === "lending" ? "Lending"
            : "Other",
          change24h: priceData?.change24h,
          coingeckoId: token.coingeckoId,
          allocationPct: 0,
        });
      }

      // Sort by USD value descending
      positions.sort((a, b) => b.valueUsd - a.valueUsd);

      // Compute allocation percentages
      const totalUsdValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
      for (const p of positions) {
        p.allocationPct = totalUsdValue > 0 ? (p.valueUsd / totalUsdValue) * 100 : 0;
      }

      // Category breakdown
      const stablecoinTotal = positions.filter((p) => p.category === "Stablecoin").reduce((s, p) => s + p.valueUsd, 0);
      const ethDerivTotal = positions.filter((p) => p.category === "ETH Derivative").reduce((s, p) => s + p.valueUsd, 0);
      const govTotal = positions.filter((p) => p.category === "Governance").reduce((s, p) => s + p.valueUsd, 0);

      const topToken = positions[0]?.symbol ?? null;

      return {
        summary: {
          totalUsdValue,
          positionCount: positions.length,
          nativeBalance: balances.native.formatted,
          topToken,
          stablecoinPct: totalUsdValue > 0 ? (stablecoinTotal / totalUsdValue) * 100 : 0,
          ethDerivativePct: totalUsdValue > 0 ? (ethDerivTotal / totalUsdValue) * 100 : 0,
          governancePct: totalUsdValue > 0 ? (govTotal / totalUsdValue) * 100 : 0,
        },
        positions,
        protocolExposure: computeProtocolExposure(positions, totalUsdValue),
        riskFlags: computeRiskFlags(positions, totalUsdValue),
        timestamp: Date.now(),
        isStale: false,
      };
    });

    const headers: Record<string, string> = (data as { isStale?: boolean }).isStale
      ? { "Cache-Control": "public, max-age=0, stale-while-revalidate=120", "X-Cache-Status": "STALE" }
      : { "Cache-Control": "public, max-age=60, stale-while-revalidate=120", "X-Cache-Status": "HIT" };

    return NextResponse.json(data, { status: 200, headers });
  } catch (err) {
    console.error("Portfolio API error:", err);
    return NextResponse.json(EMPTY_RESPONSE, { status: 200, headers: { "X-Cache-Status": "ERROR" } });
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 30;
