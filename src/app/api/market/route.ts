// src/app/api/market/route.ts
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

export async function GET() {
  try {
    const data = await cache.getOrFetch("market", CACHE_TTL.PRICES, async () => {
      const tokenIds = ["ethereum", "aave", "uniswap", "compound-governance-token", "lido-dao"];

      const [cgRes, protocolsRes] = await Promise.all([
        fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokenIds.join(",")}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`,
          { cache: "no-store" }
        ),
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
      ]);

      let tokens: Array<{ id: string; symbol: string; name: string; price: number; change24h: number; volume24h: number; marketCap: number; tvl?: number; chain?: string }> = [];
      if (cgRes.ok) {
        const cgData = await cgRes.json();
        tokens = (cgData as Array<{
          id: string; symbol: string; name: string; current_price: number;
          price_change_percentage_24h: number; total_volume: number; market_cap: number;
        }>).map(c => ({
          id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
          price: c.current_price, change24h: c.price_change_percentage_24h || 0,
          volume24h: c.total_volume || 0, marketCap: c.market_cap || 0, tvl: 0, chain: ""
        }));
      }

      if (protocolsRes.ok) {
        const allProtocols = await protocolsRes.json();
        const baseProtos = allProtocols
          .filter((p: { chainTvls: Record<string, number>; category: string }) =>
            (p.chainTvls?.Base || 0) > 0 && !["CEX", "Chain", "Bridge"].includes(p.category)
          )
          .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) =>
            (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0)
          );

        tokens.push(...baseProtos.slice(0, 8).map((p: { name: string; chainTvls: Record<string, number>; change_1d?: number }) => ({
          id: p.name.toLowerCase().replace(/ /g, "-"), symbol: p.name.slice(0, 6).toUpperCase(),
          name: p.name, price: 0, change24h: p.change_1d || 0, volume24h: 0,
          marketCap: p.chainTvls.Base || 0, tvl: p.chainTvls.Base || 0, chain: "Base"
        })));
      }

      const result = {
        tokens,
        summary: {
          totalTokens: tokens.length,
          avgChange24h: tokens.length > 0 ? tokens.reduce((s: number, t: { change24h: number }) => s + t.change24h, 0) / tokens.length : 0,
          totalVolume24h: tokens.reduce((s: number, t: { volume24h: number }) => s + t.volume24h, 0),
        },
        topGainers: [...tokens].sort((a: { change24h: number }, b: { change24h: number }) => b.change24h - a.change24h).slice(0, 5),
        topLosers: [...tokens].sort((a: { change24h: number }, b: { change24h: number }) => a.change24h - b.change24h).slice(0, 5),
        topByVolume: [...tokens].sort((a: { volume24h: number }, b: { volume24h: number }) => b.volume24h - a.volume24h).slice(0, 10),
        timestamp: Date.now(),
      };

      return result;
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Market fetch failed" }, { status: 500 });
  }
}
