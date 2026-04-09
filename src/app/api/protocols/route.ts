// src/app/api/protocols/route.ts
// List all Base protocols ranked by TVL — lightweight summary for bulk consumption.

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface ProtocolDatum {
  name: string;
  slug?: string;
  id?: string;
  category: string;
  audits: number;
  forkedFrom?: string[];
  change_1d?: number;
  change_7d?: number;
  chainTvls: Record<string, number>;
}

const EXCLUDED = new Set(["CEX", "Chain", "Bridge", "Liquidity Manager", "RWA"]);

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("protocols-list", CACHE_TTL.PROTOCOL_LIST, async () => {
      const res = await fetch("https://api.llama.fi/protocols", { cache: "no-store" });
      if (!res.ok) throw new Error(`protocols fetch failed: ${res.status}`);

      const protocols: ProtocolDatum[] = await res.json();
      const baseProtocols = protocols
        .filter((p) => (p.chainTvls?.Base ?? 0) > 0 && !EXCLUDED.has(p.category))
        .sort((a, b) => (b.chainTvls.Base ?? 0) - (a.chainTvls.Base ?? 0));

      return baseProtocols.map((p) => ({
        id: p.slug || p.name.toLowerCase().replace(/ /g, "-"),
        name: p.name,
        category: p.category,
        tvl: p.chainTvls.Base,
        change1d: p.change_1d || 0,
        change7d: p.change_7d || 0,
        audits: p.audits || 0,
      }));
    });

    return NextResponse.json(
      { protocols: data, total: data.length, timestamp: Date.now() },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ protocols: [], total: 0, timestamp: Date.now(), error: "Failed to fetch protocols" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 300;
