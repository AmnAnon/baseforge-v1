// src/app/api/market/route.ts
// Market Overview — real token data for the top Base ecosystem tokens.
// Sources: CoinGecko for prices/volume/mcap, DefiLlama for TVL context.
//
// Strategy: Fetch a curated list of real Base ecosystem tokens from CoinGecko
// with proper IDs, logos, and market data. No mixing protocol TVL with token prices.

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// ─── Curated Base ecosystem tokens with CoinGecko IDs ──────────────

interface TokenMeta {
  cgId: string;
  symbol: string;
  name: string;
  logo: string;
}

const BASE_TOKENS: TokenMeta[] = [
  { cgId: "ethereum", symbol: "ETH", name: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { cgId: "usd-coin", symbol: "USDC", name: "USD Coin", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  { cgId: "coinbase-wrapped-btc", symbol: "cbBTC", name: "Coinbase Wrapped BTC", logo: "https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp" },
  { cgId: "aerodrome-finance", symbol: "AERO", name: "Aerodrome", logo: "https://assets.coingecko.com/coins/images/31745/small/token.png" },
  { cgId: "uniswap", symbol: "UNI", name: "Uniswap", logo: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg" },
  { cgId: "aave", symbol: "AAVE", name: "Aave", logo: "https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png" },
  { cgId: "dai", symbol: "DAI", name: "Dai", logo: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png" },
  { cgId: "coinbase-wrapped-staked-eth", symbol: "cbETH", name: "Coinbase Staked ETH", logo: "https://assets.coingecko.com/coins/images/27008/small/cbeth.png" },
  { cgId: "compound-governance-token", symbol: "COMP", name: "Compound", logo: "https://assets.coingecko.com/coins/images/10775/small/COMP.png" },
  { cgId: "moonwell-artemis", symbol: "WELL", name: "Moonwell", logo: "https://assets.coingecko.com/coins/images/26133/small/moonwell.png" },
  { cgId: "seamless-protocol", symbol: "SEAM", name: "Seamless", logo: "https://assets.coingecko.com/coins/images/33480/small/Seamless_Logo_Black_Transparent.png" },
  { cgId: "baseswap", symbol: "BSWAP", name: "BaseSwap", logo: "https://assets.coingecko.com/coins/images/31245/small/Baseswap_LogoNew.png" },
  { cgId: "extra-finance", symbol: "EXTRA", name: "Extra Finance", logo: "https://assets.coingecko.com/coins/images/31267/small/extra_finance.jpeg" },
  { cgId: "morpho", symbol: "MORPHO", name: "Morpho", logo: "https://assets.coingecko.com/coins/images/38440/small/morpho.jpg" },
  { cgId: "ondo-finance", symbol: "ONDO", name: "Ondo Finance", logo: "https://assets.coingecko.com/coins/images/26580/small/ONDO.png" },
  { cgId: "brett", symbol: "BRETT", name: "Brett", logo: "https://assets.coingecko.com/coins/images/35529/small/1000050750.png" },
  { cgId: "degen-base", symbol: "DEGEN", name: "Degen", logo: "https://assets.coingecko.com/coins/images/34515/small/android-chrome-512x512.png" },
  { cgId: "toshi-base", symbol: "TOSHI", name: "Toshi", logo: "https://assets.coingecko.com/coins/images/31126/small/toshi.png" },
  { cgId: "virtual-protocol", symbol: "VIRTUAL", name: "Virtuals Protocol", logo: "https://assets.coingecko.com/coins/images/36172/small/virtual.jpeg" },
  { cgId: "wrapped-ether-mantle-bridge", symbol: "WETH", name: "Wrapped ETH", logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png" },
  { cgId: "chainlink", symbol: "LINK", name: "Chainlink", logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { cgId: "synthetix-network-token", symbol: "SNX", name: "Synthetix", logo: "https://assets.coingecko.com/coins/images/3406/small/SNX.png" },
  { cgId: "usds", symbol: "USDS", name: "USDS", logo: "https://assets.coingecko.com/coins/images/39926/small/usds.webp" },
  { cgId: "rocket-pool-eth", symbol: "rETH", name: "Rocket Pool ETH", logo: "https://assets.coingecko.com/coins/images/20764/small/reth.png" },
  { cgId: "maker", symbol: "MKR", name: "Maker", logo: "https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png" },
  { cgId: "lido-dao", symbol: "LDO", name: "Lido DAO", logo: "https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png" },
  { cgId: "pendle", symbol: "PENDLE", name: "Pendle", logo: "https://assets.coingecko.com/coins/images/15069/small/Pendle_Logo_Normal-03.png" },
  { cgId: "beefy-finance", symbol: "BIFI", name: "Beefy Finance", logo: "https://assets.coingecko.com/coins/images/12704/small/bifi.png" },
  { cgId: "yearn-finance", symbol: "YFI", name: "Yearn Finance", logo: "https://assets.coingecko.com/coins/images/11849/small/yearn.jpg" },
  { cgId: "wrapped-bitcoin", symbol: "WBTC", name: "Wrapped Bitcoin", logo: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png" },
];

// ─── Token response type ────────────────────────────────────────────

interface MarketToken {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

// ─── Route ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("market-v2", CACHE_TTL.PRICES, async () => {
      // Build CoinGecko IDs string
      const ids = BASE_TOKENS.map((t) => t.cgId).join(",");

      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true`,
        { cache: "no-store", signal: AbortSignal.timeout(10_000) }
      );

      if (!res.ok) {
        throw new Error(`CoinGecko returned ${res.status}`);
      }

      const cg: Record<string, {
        usd?: number;
        usd_24h_vol?: number;
        usd_24h_change?: number;
        usd_market_cap?: number;
      }> = await res.json();

      // Map CoinGecko response to our token list
      const tokens: MarketToken[] = [];

      for (const meta of BASE_TOKENS) {
        const data = cg[meta.cgId];
        if (!data || !data.usd) continue; // Skip tokens CoinGecko doesn't have

        tokens.push({
          id: meta.cgId,
          symbol: meta.symbol,
          name: meta.name,
          logo: meta.logo,
          price: data.usd,
          change24h: Math.round((data.usd_24h_change || 0) * 100) / 100,
          volume24h: Math.round(data.usd_24h_vol || 0),
          marketCap: Math.round(data.usd_market_cap || 0),
        });
      }

      // Sort by market cap by default
      tokens.sort((a, b) => b.marketCap - a.marketCap);

      const validTokens = tokens.filter((t) => t.price > 0);

      return {
        tokens: validTokens,
        summary: {
          totalTokens: validTokens.length,
          avgChange24h: validTokens.length > 0
            ? Math.round(validTokens.reduce((s, t) => s + t.change24h, 0) / validTokens.length * 100) / 100
            : 0,
          totalVolume24h: validTokens.reduce((s, t) => s + t.volume24h, 0),
        },
        topGainers: [...validTokens].sort((a, b) => b.change24h - a.change24h).slice(0, 10),
        topLosers: [...validTokens].sort((a, b) => a.change24h - b.change24h).slice(0, 10),
        topByVolume: [...validTokens].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10),
        timestamp: Date.now(),
        isStale: false,
      };
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        "X-Cache-Status": "HIT",
        "X-Data-Source": "coingecko",
      },
    });
  } catch (err) {
    logger.error("Market API error", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      {
        tokens: [],
        summary: { totalTokens: 0, avgChange24h: 0, totalVolume24h: 0 },
        topGainers: [],
        topLosers: [],
        topByVolume: [],
        timestamp: Date.now(),
        isStale: true,
      },
      { status: 200, headers: { "Cache-Control": "public, max-age=0, stale-while-revalidate=300" } }
    );
  }
}
