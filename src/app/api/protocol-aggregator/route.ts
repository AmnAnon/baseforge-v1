// src/app/api/protocol-aggregator/route.ts
/**
 * Protocol Aggregator API
 * Merges DefiLlama + on-chain data into unified protocol profiles.
 * Returns Top 20 Base protocols with canonical health scores.
 */
import { NextResponse } from "next/server";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { aggregateProtocols } from "@/lib/protocol-aggregator";

const PROTOCOL_LOGOS: Record<string, string> = {
  Aerodrome: "https://icons.llama.fi/icons/protocols/aerodrome",
  Moonwell: "https://icons.llama.fi/icons/protocols/moonwell",
  "Sonne Finance": "https://icons.llama.fi/icons/protocols/sonne-finance",
  "Seamless Protocol": "https://icons.llama.fi/icons/protocols/seamless-protocol",
  "Compound V3": "https://icons.llama.fi/icons/protocols/compound-v3",
  "Aave V3": "https://icons.llama.fi/icons/protocols/aave-v3",
};

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const result = await aggregateProtocols();
    const aggregated = result.protocols.slice(0, 20).map((p) => ({
      id: p.slug,
      name: p.name,
      symbol: p.name.slice(0, 6),
      category: p.category,
      tvl: p.tvl,
      tvlChange24h: p.tvlChange24h,
      tvlChange7d: p.tvlChange7d,
      dominanceScore: p.dominanceScore,
      protocolScore: p.healthScore,
      riskScore: p.riskScore,
      auditStatus: p.auditStatus,
      logo: PROTOCOL_LOGOS[p.name] || p.logo || "",
      forks: p.forkedFrom || [],
      oracles: p.oracles,
      riskFactors: p.riskFactors,
      warning: p.warning,
      dataSource: p.dataSource,
    }));

    return NextResponse.json(aggregated);
  } catch (err) {
    logger.error("Protocol aggregator error", { error: String(err) });
    return NextResponse.json({ error: "Aggregation failed" }, { status: 500 });
  }
}