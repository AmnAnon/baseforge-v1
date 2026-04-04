// src/app/api/portfolio/route.ts
// Portfolio tracker — aggregated TVL/borrow positions for a wallet across Base protocols
// Uses DefiLlama protocol-level data (no direct onchain RPC needed)
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

interface PortfolioPosition {
  protocol: string;
  tvl: number;
  borrowed: number;
  netValue: number;
  category: string;
  healthEstimate: number;
  apy: number;
}

interface PortfolioSummary {
  totalDeposited: number;
  totalBorrowed: number;
  netWorth: number;
  positionCount: number;
  highestRisk: string | null;
  avgHealth: number;
}

interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
  timestamp: number;
}

const isAddressValid = (addr: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(addr);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const address = url.searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
    }

    if (!isAddressValid(address)) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }

    const cacheKey = `portfolio-${address.toLowerCase()}`;
    const data = await cache.getOrFetch(cacheKey, CACHE_TVL_HISTORY, async () => {
      // Fetch all Base protocols — simulate per-wallet positions
      // In production: call DefiLlama /protocol/{slug} endpoints or use onchain multicall
      const [protocolsRes] = await Promise.all([
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
      ]);

      if (!protocolsRes.ok) throw new Error("Failed to fetch protocols");

      const protocols = await protocolsRes.json();

      const baseProtos = protocols
        .filter((p: { chainTvls?: Record<string, number> }) => (p.chainTvls?.Base || 0) > 100_000)
        .sort((a: { chainTvls: Record<string, number> }, b: { chainTvls: Record<string, number> }) =>
          (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0)
        );

      // Generate portfolio positions based on protocol data
      // This represents the wallet's positions across protocols
      // In production: replace with actual onchain balance calls
      const positions: PortfolioPosition[] = [];

      return {
        summary: {
          totalDeposited: 0,
          totalBorrowed: 0,
          netWorth: 0,
          positionCount: 0,
          highestRisk: null,
          avgHealth: 0,
        },
        positions,
        timestamp: Date.now(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Portfolio API error:", err);
    return NextResponse.json({ error: "Portfolio fetch failed" }, { status: 500 });
  }
}
