// src/app/api/risk-history/route.ts
// Historical risk scores for individual protocols
// Provides time-series: health score, audit changes, TVL-based risk over time
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

interface RiskHistoryPoint {
  date: string;
  healthScore: number;
  tvl: number;
  change24h: number;
  tvlVolatility: number; // 7d range as percentage
  category: string;
  audits: number;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const protocol = url.searchParams.get("protocol");

    if (!protocol) {
      return NextResponse.json({ error: "Missing protocol parameter" }, { status: 400 });
    }

    const cacheKey = `risk-history-${protocol.toLowerCase()}`;
    const data = await cache.getOrFetch(cacheKey, CACHE_TTL.PROTOCOL_LIST, async () => {
      // Fetch single protocol history
      const res = await fetch(
        `https://api.llama.fi/protocol/${protocol}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch protocol data for ${protocol}`);
      }

      const protocolData = await res.json();
      const baseHistory = protocolData?.chainTvls?.Base?.tvl || [];

      if (baseHistory.length === 0) {
        return { history: [], protocol: protocolData.name } as { history: RiskHistoryPoint[]; protocol: string };
      }

      // Calculate risk metrics over time
      const auditCount = protocolData.audits || 0;
      const history: RiskHistoryPoint[] = [];

      // Use weekly samples for a clean 30-day view
      const windowSize = 7; // days for volatility calc

      for (let i = 0; i < baseHistory.length; i += 7) {
        const point = baseHistory[i];
        const tvl = point.tvl || 0;

        // Calculate 7d volatility from nearby points
        const window = baseHistory.slice(Math.max(0, i - windowSize), i + 1);
        const volatility = window.length > 1
          ? (Math.max(...window.map(p => p.tvl)) - Math.min(...window.map(p => p.tvl))) / (Math.max(...window.map(p => p.tvl)) || 1)
          : 0;

        // Simulate health score over time
        let score = 50 + auditCount * 5;
        if (tvl > 100_000_000) score += 15;
        else if (tvl > 10_000_000) score += 10;
        else if (tvl > 1_000_000) score += 5;
        if (volatility > 0.3) score -= 20;
        else if (volatility > 0.15) score -= 10;
        score = Math.max(0, Math.min(100, score));

        const change24h = calculateChange(baseHistory, i);

        history.push({
          date: new Date(point.date * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          healthScore: Math.round(score),
          tvl,
          change24h,
          tvlVolatility: Math.round(volatility * 100),
          category: protocolData.category || "DeFi",
          audits: auditCount,
        });
      }

      // Keep last 52 weeks (1 year)
      return {
        history: history.slice(-52),
        protocol: protocolData.name || protocol,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Risk history API error:", err);
    return NextResponse.json({ error: "Risk history fetch failed" }, { status: 500 });
  }
}

function calculateChange(history: Array<{ tvl: number }>, index: number): number {
  if (index < 1) return 0;
  const current = history[index]?.tvl || 0;
  const previous = history[index - 7]?.tvl || current;
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}
