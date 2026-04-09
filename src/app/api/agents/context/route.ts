// src/app/api/agents/context/route.ts
// AI Agent Context — compressed, token-efficient LLM payload.
// Single endpoint aggregates Market, Protocols, Risk for direct LLM ingestion.

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// ─── External Data Sources ──────────────────────────────────────────────

const LLAMA_PROTOCOLS = "https://api.llama.fi/protocols";
const LLAMA_CHAIN_TVL = "https://api.llama.fi/v2/historicalChainTvl/Base";
const LLAMA_YIELDS = "https://yields.llama.fi/pools?chain=Base";

const EXCLUDED = new Set(["CEX", "Chain", "Bridge", "Liquidity Manager", "RWA"]);

// ─── Types ──────────────────────────────────────────────────────────────

interface ProtocolDatum {
  name: string;
  slug?: string;
  audits: number;
  category: string;
  change_1d?: number;
  change_7d: number;
  oracles?: string[];
  forkedFrom?: string[];
  chainTvls: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeRisk(p: ProtocolDatum, totalTvl: number) {
  const tvl = p.chainTvls.Base || 0;
  const dominance = totalTvl > 0 ? (tvl / totalTvl) * 100 : 0;
  const audits = p.audits || 0;
  const vol = clamp(Math.abs(p.change_7d || 0) / 100, 0, 1);

  let health = 50;
  health += clamp(audits * 5, 0, 25);
  if (tvl > 100_000_000) health += 15;
  else if (tvl > 10_000_000) health += 10;
  else if (tvl > 1_000_000) health += 5;
  if (p.forkedFrom?.length) health += 5;
  if (vol > 0.3) health -= 20;
  else if (vol > 0.15) health -= 10;
  if ((p.change_7d || 0) < -10) health -= 15;
  else if ((p.change_7d || 0) < -5) health -= 10;
  if (p.category === "Dexes") health += 5;
  else if (p.category === "Lending") health += 3;
  health = clamp(health, 0, 100);

  const factors: string[] = [];
  if (audits === 0) factors.push("no_audit");
  else if (audits === 1) factors.push("limited_audit");
  if (vol > 0.2) factors.push("high_volatility");
  if ((p.change_7d || 0) < -10) factors.push("rapid_decline");
  if (dominance > 30) factors.push("concentration_risk");
  if ((p.oracles?.length ?? 0) < 2) factors.push("low_oracle_diversity");

  const risk = 100 - health;
  return {
    health,
    risk,
    factors,
    level: risk > 50 ? "high" : risk > 30 ? "medium" : "low",
    auditStatus: audits >= 2 ? "audited" : audits >= 1 ? "partial" : "unaudited",
  };
}

async function fetchYields(): Promise<Record<string, number>> {
  try {
    const res = await fetch(LLAMA_YIELDS, { cache: "no-store" });
    if (!res.ok) return {};
    const json = await res.json();
    const index: Record<string, number[]> = {};
    for (const pool of (json.data || []) as { project?: string; apy?: number }[]) {
      const slug = pool.project || "";
      if (!index[slug]) index[slug] = [];
      index[slug].push(pool.apy || 0);
    }
    const avg: Record<string, number> = {};
    for (const [slug, pools] of Object.entries(index)) {
      avg[slug] = pools.reduce((s, v) => s + v, 0) / pools.length;
    }
    return avg;
  } catch {
    return {};
  }
}

// ─── GET — Compressed LLM Context ───────────────────────────────────────

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getWithStaleFallback("agent-context", CACHE_TTL.TVL_HISTORY, buildContext);
    return NextResponse.json(data, {
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type": "agent-context",
        ...(data.isStale
          ? { "Cache-Control": "public, max-age=0, stale-while-revalidate=300", "X-Cache-Status": "STALE" }
          : { "Cache-Control": "public, max-age=120, stale-while-revalidate=300", "X-Cache-Status": "HIT" }),
      },
    });
  } catch (err) {
    logger.error("Agent context error", { err: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      { snapshot: { ts: Date.now(), chain: "base" }, market: {}, risk: {}, protocols: [], anomalies: [], isStale: true },
      { status: 200 }
    );
  }
}

async function buildContext() {
  const [protRes, tvlRes] = await Promise.all([
    fetch(LLAMA_PROTOCOLS, { cache: "no-store" }),
    fetch(LLAMA_CHAIN_TVL, { cache: "no-store" }),
  ]);
  if (!protRes.ok || !tvlRes.ok) throw new Error("DefiLlama fetch failed");

  const protocols: ProtocolDatum[] = await protRes.json();
  const tvlHistory: { date: number; tvl: number }[] = await tvlRes.json();
  const yields = await fetchYields();

  const filtered = protocols
    .filter((p) => (p.chainTvls?.Base || 0) > 0 && !EXCLUDED.has(p.category))
    .sort((a, b) => (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0));

  const totalTvl = filtered.reduce((s, p) => s + (p.chainTvls.Base || 0), 0);

  // Evaluate risk for top 50
  const evaluated = filtered.slice(0, 50).map((p) => {
    const id = p.slug || p.name.toLowerCase().replace(/ /g, "-");
    const r = computeRisk(p, totalTvl);
    const apy = yields[id] || yields[p.name.toLowerCase().replace(/ /g, "-")] || 0;
    return {
      id,
      name: p.name,
      cat: p.category,
      tvl: Math.round((p.chainTvls.Base || 0)),
      c1d: Math.round((p.change_1d || 0) * 100) / 100,
      c7d: Math.round((p.change_7d || 0) * 100) / 100,
      apy: Math.round(apy * 100) / 100,
      ...r,
    };
  });

  const top15 = evaluated.slice(0, 15).map(({ id, name, cat, tvl, c1d, c7d, apy, health, risk, level, auditStatus, factors }) => ({
    id, name, cat, tvl, c1d, c7d, apy, health, risk, level, auditStatus, factors,
  }));

  // TVL trend direction
  const recent30 = tvlHistory.slice(-30).map((d) => d.tvl);
  let tvlTrend = "flat";
  if (recent30.length >= 2) {
    const pctChange = ((recent30[recent30.length - 1] - recent30[0]) / (recent30[0] || 1)) * 100;
    tvlTrend = pctChange > 5 ? "up" : pctChange < -5 ? "down" : "flat";
  }

  // Anomalies
  const anomalies: { id: string; reason: string; severity: string }[] = [];
  for (const p of top15) {
    if (p.c7d < -20) anomalies.push({ id: p.id, reason: "sharp_tvl_decline", severity: "high" });
    if (p.c7d > 50) anomalies.push({ id: p.id, reason: "rapid_tvl_growth", severity: "medium" });
    if (p.level === "high") anomalies.push({ id: p.id, reason: "high_risk_score", severity: "high" });
  }

  const avgHealth = evaluated.length > 0
    ? Math.round(evaluated.reduce((s, p) => s + p.health, 0) / evaluated.length)
    : 0;
  const highRiskCount = evaluated.filter((p) => p.level === "high").length;
  const unauditedCount = evaluated.filter((p) => p.auditStatus === "unaudited").length;

  return {
    snapshot: {
      ts: Date.now(),
      chain: "base",
    },
    market: {
      totalTvl,
      protocols: evaluated.length,
      avgApy: evaluated.length > 0 ? Math.round(evaluated.reduce((s, p) => s + p.apy, 0) / evaluated.length * 100) / 100 : 0,
      trend: tvlTrend,
    },
    risk: {
      avgHealth,
      highRisk: highRiskCount,
      unaudited: unauditedCount,
      concentration: top15.length > 0 && (top15[0].tvl / (totalTvl || 1)) > 0.3 ? "HIGH" : "MEDIUM",
      dominant: top15[0]?.name || "N/A",
    },
    protocols: top15,
    anomalies,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 120;
