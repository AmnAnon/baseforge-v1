// src/app/api/risk/route.ts
// Risk scoring engine — protocol health, TVL concentration, audit status
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { RiskResponseSchema } from "@/lib/zod/schemas";
import { scoreLlamaProtocol, toAuditStatus } from "@/lib/risk";

interface ProtocolDatum {
  name: string;
  slug?: string;
  category: string;
  audits: number;
  audit_note?: string;
  forkedFrom?: string[];
  change_7d: number;
  change_1d?: number;
  oracles?: string[];
  chainTvls: Record<string, number | Record<string, { tvl: number; date: number }[]>>;
  mcap: number;
}

const EMPTY_RISK = () => ({
  protocols: [],
  summary: { totalAnalyzed: 0, avgHealthScore: 0, highRiskCount: 0, unauditedCount: 0, dominantProtocol: "N/A", totalBaseTVL: 0, concentrationRisk: "MEDIUM" as const },
  timestamp: Date.now(),
  isStale: true,
});

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getWithStaleFallback("risk-data", CACHE_TTL.RISK_ANALYSIS, async () => {
      const protocols = await cache.getOrFetch<ProtocolDatum[]>(
        "llama-protocols",
        CACHE_TTL.PROTOCOL_LIST,
        async () => {
          const res = await fetch("https://api.llama.fi/protocols");
          if (!res.ok) throw new Error(`protocols fetch failed: ${res.status}`);
          return res.json();
        },
      );

      const baseProtocols = protocols
        .filter((p) => typeof p.chainTvls?.Base === "number" && p.chainTvls.Base > 0)
        .sort((a, b) => (b.chainTvls.Base as number) - (a.chainTvls.Base as number));

      const totalBaseTVL = baseProtocols.reduce(
        (sum, p) => sum + (p.chainTvls.Base as number), 0,
      );

      const riskData: Array<Record<string, unknown>> = [];

      for (const protocol of baseProtocols.slice(0, 50)) {
        const excludedCategories = ["CEX", "Chain", "Bridge", "Liquid Staking"];
        if (excludedCategories.includes(protocol.category)) continue;

        const tvl = protocol.chainTvls.Base as number;
        const dominanceScore = totalBaseTVL > 0 ? (tvl / totalBaseTVL) * 100 : 0;
        const auditCount = protocol.audits || 0;
        const auditStatus = toAuditStatus(auditCount);
        const change7d = protocol.change_7d || 0;
        const tvlVolatility = Math.min(Math.abs(change7d) / 100, 1);

        const scored = scoreLlamaProtocol({
          audits: auditCount,
          change_1d: protocol.change_1d,
          change_7d: change7d,
          category: protocol.category,
          oracles: protocol.oracles,
          forkedFrom: protocol.forkedFrom,
          chainTvls: { Base: tvl },
        });

        const riskFactors = [...scored.riskFactors];
        if (dominanceScore > 30) riskFactors.push("TVL concentration risk");
        if (!protocol.forkedFrom?.length && !protocol.audit_note) riskFactors.push("Unverified codebase");

        riskData.push({
          id: protocol.slug || protocol.name.toLowerCase(),
          name: protocol.name,
          tvl,
          dominanceScore: Math.round(dominanceScore * 100) / 100,
          healthScore: scored.health,
          riskScore: scored.risk,
          auditStatus,
          auditCount,
          forkedFrom: protocol.forkedFrom,
          ageDays: 365,
          tvlChange7d: change7d,
          tvlVolatility: Math.round(tvlVolatility * 100) / 100,
          category: protocol.category,
          oracles: protocol.oracles || [],
          riskFactors,
          warning: riskFactors.length > 3 ? "High risk — multiple risk factors" : undefined,
        });
      }

      riskData.sort((a, b) => (b.healthScore as number) - (a.healthScore as number));

      const avgHealthScore = riskData.length > 0
        ? Math.round(riskData.reduce((s, p) => s + (p.healthScore as number), 0) / riskData.length)
        : 0;
      const highRiskCount = riskData.filter((p) => (p.riskScore as number) > 50).length;
      const unauditedCount = riskData.filter((p) => p.auditStatus === "unaudited").length;
      const topProtocol = riskData.length > 0 ? (riskData[0].name as string) : "N/A";
      const topDominance = riskData.length > 0 ? (riskData[0].dominanceScore as number) : 0;

      return {
        protocols: riskData,
        summary: {
          totalAnalyzed: riskData.length,
          avgHealthScore,
          highRiskCount,
          unauditedCount,
          dominantProtocol: topProtocol,
          totalBaseTVL,
          concentrationRisk: topDominance > 30 ? "HIGH" : "MEDIUM",
        },
        timestamp: Date.now(),
      };
    });

    const validated = validateOrFallback(RiskResponseSchema, data, EMPTY_RISK(), "risk");
    const headers: Record<string, string> = validated.isStale
      ? { "Cache-Control": "public, max-age=0, stale-while-revalidate=120", "X-Cache-Status": "STALE" }
      : { "Cache-Control": "public, max-age=60, stale-while-revalidate=120", "X-Cache-Status": "HIT" };

    return NextResponse.json(validated, { headers });
  } catch {
    return NextResponse.json(
      { ...EMPTY_RISK(), isStale: true },
      { status: 200, headers: { "Cache-Control": "public, max-age=0, stale-while-revalidate=120" } },
    );
  }
}

export const revalidate = 600;