// src/app/api/market/route.ts
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

// Same exclusion as analytics — CEX/Chain/Bridge are not DeFi protocols
const EXCLUDED = new Set(["CEX", "Chain", "Bridge", "Liquidity Manager", "RWA"]);

export async function GET() {
  try {
    const data = await cache.getOrFetch("market", CACHE_TTL.PRICES, async () => {
      const [priceRes, protocolsRes, yieldsRes] = await Promise.all([
        // /simple/price — cheaper endpoint, less rate-limiting
        fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,aave,uniswap,lido-dao,compound-governance-token,pendle,morpho,maker,aerodrome-finance,ondo,synthetix-network-token&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true",
          { cache: "no-store" }
        ),
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
        fetch("https://yields.llama.fi/pools", { cache: "no-store" }),
      ]);

      let tokens: Array<{
        id: string; symbol: string; name: string; price: number;
        change24h: number; volume24h: number; marketCap: number;
        tvl?: number; chain?: string; apy?: number;
      }> = [];

      // CoinGecko prices
      if (priceRes.ok) {
        const cg = await priceRes.json();
        const info: Record<string, { name: string; sym: string }> = {
          ethereum: { name: "Ethereum", sym: "ETH" },
          bitcoin: { name: "Bitcoin", sym: "BTC" },
          aave: { name: "Aave", sym: "AAVE" },
          uniswap: { name: "Uniswap", sym: "UNI" },
          "lido-dao": { name: "Lido DAO", sym: "LDO" },
          "compound-governance-token": { name: "Compound", sym: "COMP" },
          pendle: { name: "Pendle", sym: "PENDLE" },
          morpho: { name: "Morpho", sym: "MORPHO" },
          maker: { name: "Maker", sym: "MKR" },
          "aerodrome-finance": { name: "Aerodrome", sym: "AERO" },
          ondo: { name: "Ondo", sym: "ONDO" },
          "synthetix-network-token": { name: "Synthetix", sym: "SNX" },
        };
        for (const [id, p] of Object.entries(cg)) {
          if (typeof p !== "object" || !p || Array.isArray(p)) continue;
          const obj = p as Record<string, number>;
          tokens.push({
            id, name: info[id]?.name || id, symbol: info[id]?.sym || id.slice(0, 6).toUpperCase(),
            price: obj.usd || 0,
            change24h: obj.usd_24h_change || 0,
            volume24h: obj.usd_24h_vol || 0,
            marketCap: obj.usd_market_cap || 0, tvl: 0, chain: "", apy: 0,
          });
        }
      }

      // Yields for APY
      const yieldMap: Record<string, number> = {};
      if (yieldsRes.ok) {
        const yd = await yieldsRes.json();
        for (const p of yd.data || []) {
          if (!yieldMap[p.project] && p.apy > 0) yieldMap[p.project] = p.apy;
        }
      }

      // Top 20 Base-native DeFi protocols (CEX excluded, by TVL)
      if (protocolsRes.ok) {
        const all = await protocolsRes.json();
        const baseProtos = all
          .filter((p: { chainTvls?: Record<string, number>; category?: string }) => {
            const baseTvl = p.chainTvls?.Base || 0;
            if (baseTvl < 100_000) return false;
            const cat = (p.category || "").trim();
            if (EXCLUDED.has(cat)) return false;
            return true;
          })
          .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) =>
            (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0)
          )
          .slice(0, 20);

        for (const p of baseProtos) {
          const slug = (p.name || "").toLowerCase().replace(/ /g, "-");
          tokens.push({
            id: slug, symbol: (p.name || "").slice(0, 6).toUpperCase(),
            name: p.name, price: 0,
            change24h: p.change_1d || 0, volume24h: 0,
            marketCap: p.chainTvls.Base || 0,
            tvl: p.chainTvls.Base || 0, chain: "Base",
            apy: yieldMap[slug] || yieldMap[(p.name || "").toLowerCase()] || 0,
          });
        }
      }

      return {
        tokens,
        summary: {
          totalTokens: tokens.length,
          avgChange24h: tokens.reduce((s: number, t: { change24h: number }) => s + t.change24h, 0) / (tokens.length || 1),
          totalVolume24h: tokens.reduce((s: number, t: { volume24h: number }) => s + t.volume24h, 0),
        },
        topGainers: [...tokens].sort((a, b) => b.change24h - a.change24h).slice(0, 5),
        topLosers: [...tokens].sort((a, b) => a.change24h - b.change24h).slice(0, 5),
        topByVolume: [...tokens].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10),
        timestamp: Date.now(),
      };
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Market error:", err);
    return NextResponse.json({
      tokens: [], summary: { totalTokens: 0, avgChange24h: 0, totalVolume24h: 0 },
      topGainers: [], topLosers: [], topByVolume: [],
    }, { status: 500 });
  }
}
