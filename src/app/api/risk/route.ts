// src/app/api/risk/route.ts
// Risk scoring engine — protocol health, TVL concentration, audit status
import { NextResponse } from "next/server";

interface ProtocolRisk {
  id: string;
  name: string;
  tvl: number;
  dominanceScore: number; // % of total Base TVL
  healthScore: number; // 0-100, higher is better
  riskScore: number; // 0-100, lower is better
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

export async function GET() {
  try {
    const [protocolsRes, baseTVLRes] = await Promise.all([
      fetch("https://api.llama.fi/protocols", { next: { revalidate: 3600 } }),
      fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { next: { revalidate: 300 } }),
    ]);

    if (!protocolsRes.ok || !baseTVLRes.ok) {
      throw new Error("Failed to fetch data for risk analysis");
    }

    const allProtocols = await protocolsRes.json();
    const tvlHistory = await baseTVLRes.json();

    const baseProtocols = allProtocols
      .filter((p: any) => p.chainTvls?.Base > 0)
      .sort((a: any, b: any) => (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0));

    const totalBaseTVL = baseProtocols.reduce(
      (sum: number, p: any) => sum + (p.chainTvls.Base || 0),
      0
    );

    const tvlChanges: Record<string, number[]> = {};

    // Calculate TVL changes for each protocol
    for (const protocol of baseProtocols.slice(0, 30)) {
      try {
        const histRes = await fetch(
          `https://api.llama.fi/protocol/${protocol.name}`,
          { next: { revalidate: 600 } }
        );
        if (histRes.ok) {
          const data = await histRes.json();
          const baseTvlSeries = data.chainTvls?.Base?.tvl || [];
          if (baseTvlSeries.length > 7) {
            tvlChanges[protocol.name] = baseTvlSeries.slice(-7).map((d: any) => d.tvl);
          }
        }
      } catch (e) {
        // Skip individual protocol if fetch fails
      }
    }

    const riskData: ProtocolRisk[] = [];

    for (const protocol of baseProtocols.slice(0, 50)) {
      // Skip CEX and non-protocol entries
      const excludedCategories = ["CEX", "Chain", "Bridge", "Liquid Staking"];
      if (excludedCategories.includes(protocol.category)) continue;

      const tvl = protocol.chainTvls.Base || 0;
      const dominanceScore = totalBaseTVL > 0 ? (tvl / totalBaseTVL) * 100 : 0;
      const auditCount = protocol.audits || 0;
      const auditStatus = auditCount > 0 ? (auditCount >= 2 ? "audited" : "partial") : "unaudited";
      const isForked = protocol.forkedFrom && protocol.forkedFrom.length > 0;
      const change7d = protocol.change_7d || 0;

      // TVL volatility (7d range)
      const hist = tvlChanges[protocol.name];
      const tvlVolatility = hist
        ? (Math.max(...hist) - Math.min(...hist)) / Math.max(...hist)
        : 0;

      // Protocol age estimation (from first commit or registration)
      const ageDays = 365; // Placeholder — would derive from GitHub first commit

      // Calculate health score (0-100)
      let healthScore = 50; // Baseline

      // Audit bonus
      healthScore += auditCount * 5;

      // TVL size bonus (more TVL = more decentralized trust)
      if (tvl > 100_000_000) healthScore += 15;
      else if (tvl > 10_000_000) healthScore += 10;
      else if (tvl > 1_000_000) healthScore += 5;

      // Forked protocol bonus (battle-tested code)
      if (isForked) healthScore += 5;

      // Stable TVL penalty for high volatility
      if (tvlVolatility > 0.3) healthScore -= 20;
      else if (tvlVolatility > 0.15) healthScore -= 10;

      // Negative change penalty
      if (change7d < -10) healthScore -= 15;
      else if (change7d < -5) healthScore -= 10;

      // Category risk
      if (protocol.category === "Dexes") healthScore += 5;
      else if (protocol.category === "Lending") healthScore += 3;

      healthScore = Math.max(0, Math.min(100, healthScore));

      // Calculate risk score (inverse of health)
      const riskScore = 100 - healthScore;

      // Identify risk factors
      const riskFactors: string[] = [];
      if (auditStatus === "unaudited") riskFactors.push("No audit");
      else if (auditStatus === "partial") riskFactors.push("Limited audit");

      if (tvlVolatility > 0.2) riskFactors.push("High TVL volatility");
      if (change7d < -10) riskFactors.push("Rapid TVL decline");
      if (dominanceScore > 30) riskFactors.push("TVL concentration risk");
      if (protocol.oracles?.length < 2) riskFactors.push("Limited oracle diversity");
      if (!isForked && !protocol.audit_note) riskFactors.push("Unverified codebase");

      const riskEntry: ProtocolRisk = {
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
        warning: riskFactors.length > 3 ? "High risk — multiple risk factors detected" : undefined,
      };

      riskData.push(riskEntry);
    }

    // Sort by health score (best first)
    riskData.sort((a, b) => b.healthScore - a.healthScore);

    // Calculate aggregate risk metrics
    const avgHealthScore = riskData.length > 0
      ? Math.round(riskData.reduce((sum, p) => sum + p.healthScore, 0) / riskData.length)
      : 0;

    const highRiskProtocols = riskData.filter(p => p.riskScore > 50).length;
    const unauditedProtocols = riskData.filter(p => p.auditStatus === "unaudited").length;

    return NextResponse.json({
      protocols: riskData,
      summary: {
        totalAnalyzed: riskData.length,
        avgHealthScore,
        highRiskCount: highRiskProtocols,
        unauditedCount: unauditedProtocols,
        dominantProtocol: riskData.length > 0 ? riskData[0].name : "N/A",
        totalBaseTVL,
        concentrationRisk: riskData.length > 0 && riskData[0].dominanceScore > 30
          ? "HIGH"
          : "MEDIUM",
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

export const revalidate = 600; // Cache for 10 minutes — risk data doesn't change fast
