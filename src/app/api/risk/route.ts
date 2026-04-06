// src/app/api/risk/route.ts
// Risk scoring engine — protocol health, TVL concentration, audit status
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

interface ProtocolRisk {
  id: string;
  name: string;
  tvl: number;
  dominanceScore: number;
  healthScore: number;
  riskScore: number;
  auditStatus: "audited" | "unaudited" | "partial";
  auditCount: number;
  forkedFrom?: string[];
  ageDays: number;
  tvlChange7d: number;
  tvlVolatility: number;
  category: string;
  oracles: string[];
  riskFactors: string[];
  warning?: string;
}

interface ProtocolDatum {
  name: string;
  slug?: string;
  category: string;
  audits: number;
  audit_note?: string;
  forkedFrom?: string[];
  change_7d: number;
  oracles?: string[];
  chainTvls: Record<string, number | Record<string, { tvl: number; date: number }[]>>;
  mcap: number;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const protocols = await cache.getOrFetch<ProtocolDatum[]>(
      "llama-protocols",
      CACHE_TTL.PROTOCOL_LIST,
      async () => {
        const res = await fetch("https://api.llama.fi/protocols");
        if (!res.ok) throw new Error(`protocols fetch failed: ${res.status}`);
        return res.json();
      }
    );

    const baseProtocols = protocols
      .filter((p) => typeof p.chainTvls?.Base === "number" && p.chainTvls.Base > 0)
      .sort((a, b) => (b.chainTvls.Base as number) - (a.chainTvls.Base as number));

    const totalBaseTVL = baseProtocols.reduce(
      (sum, p) => sum + (p.chainTvls.Base as number), 0
    );

    const riskData: ProtocolRisk[] = [];

    for (const protocol of baseProtocols.slice(0, 50)) {
      const excludedCategories = ["CEX", "Chain", "Bridge", "Liquid Staking"];
      if (excludedCategories.includes(protocol.category)) continue;

      const tvl = protocol.chainTvls.Base as number;
      const dominanceScore = totalBaseTVL > 0 ? (tvl / totalBaseTVL) * 100 : 0;
      const auditCount = protocol.audits || 0;
      const auditStatus = auditCount > 0 ? (auditCount >= 2 ? "audited" : "partial") : "unaudited";
      const isForked = protocol.forkedFrom && protocol.forkedFrom.length > 0;
      const change7d = protocol.change_7d || 0;

      // Approximate TVL volatility from 7d change magnitude
      const tvlVolatility = Math.min(Math.abs(change7d) / 100, 1);

      const ageDays = 365;

      let healthScore = 50;
      healthScore += Math.min(auditCount * 5, 25);
      if (tvl > 100_000_000) healthScore += 15;
      else if (tvl > 10_000_000) healthScore += 10;
      else if (tvl > 1_000_000) healthScore += 5;
      if (isForked) healthScore += 5;
      if (tvlVolatility > 0.3) healthScore -= 20;
      else if (tvlVolatility > 0.15) healthScore -= 10;
      if (change7d < -10) healthScore -= 15;
      else if (change7d < -5) healthScore -= 10;
      if (protocol.category === "Dexes") healthScore += 5;
      else if (protocol.category === "Lending") healthScore += 3;

      healthScore = Math.max(0, Math.min(100, healthScore));
      const riskScore = 100 - healthScore;

      const riskFactors: string[] = [];
      if (auditStatus === "unaudited") riskFactors.push("No audit");
      else if (auditStatus === "partial") riskFactors.push("Limited audit");
      if (tvlVolatility > 0.2) riskFactors.push("High TVL volatility");
      if (change7d < -10) riskFactors.push("Rapid TVL decline");
      if (dominanceScore > 30) riskFactors.push("TVL concentration risk");
      if ((protocol.oracles?.length ?? 0) < 2) riskFactors.push("Limited oracle diversity");
      if (!isForked && !protocol.audit_note) riskFactors.push("Unverified codebase");

      riskData.push({
        id: protocol.slug || protocol.name.toLowerCase(),
        name: protocol.name,
        tvl,
        dominanceScore: Math.round(dominanceScore * 100) / 100,
        healthScore,
        riskScore,
        auditStatus,
        auditCount,
        forkedFrom: protocol.forkedFrom,
        ageDays,
        tvlChange7d: change7d,
        tvlVolatility: Math.round(tvlVolatility * 100) / 100,
        category: protocol.category,
        oracles: protocol.oracles || [],
        riskFactors,
        warning: riskFactors.length > 3 ? "High risk — multiple risk factors" : undefined,
      });
    }

    riskData.sort((a, b) => b.healthScore - a.healthScore);

    const avgHealthScore = riskData.length > 0
      ? Math.round(riskData.reduce((s, p) => s + p.healthScore, 0) / riskData.length)
      : 0;
    const highRiskProtocols = riskData.filter((p) => p.riskScore > 50).length;
    const unauditedProtocols = riskData.filter((p) => p.auditStatus === "unaudited").length;

    return NextResponse.json({
      protocols: riskData,
      summary: {
        totalAnalyzed: riskData.length,
        avgHealthScore,
        highRiskCount: highRiskProtocols,
        unauditedCount: unauditedProtocols,
        dominantProtocol: riskData.length > 0 ? riskData[0].name : "N/A",
        totalBaseTVL,
        concentrationRisk: riskData.length > 0 && riskData[0].dominanceScore > 30 ? "HIGH" : "MEDIUM",
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Risk API error:", error);
    return NextResponse.json(
      { error: "Failed to analyze protocol risks" },
      { status: 500 }
    );
  }
}

export const revalidate = 600;
