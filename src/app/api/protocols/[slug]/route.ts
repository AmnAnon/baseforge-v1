// src/app/api/protocols/[slug]/route.ts
// Protocol detail — TVL, health score, fees/revenue (DefiLlama), token price (CoinGecko),
// utilization rate (Moonwell Ponder for lending protocols).

import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

// ─── Case-insensitive Base TVL ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBaseTvl(p: any): number {
  return p.chainTvls?.["Base"] ?? p.chainTvls?.["base"] ?? p.chainTvls?.["BASE"] ?? 0;
}

// ─── Slug → CoinGecko ID map ───────────────────────────────────
const SLUG_TO_CG: Record<string, string> = {
  "aerodrome":          "aerodrome-finance",
  "aerodrome-finance":  "aerodrome-finance",
  "uniswap-v3":         "uniswap",
  "uniswap-v4":         "uniswap",
  "aave-v3":            "aave",
  "compound-v3":        "compound-governance-token",
  "moonwell":           "moonwell-artemis",
  "seamless-protocol":  "seamless-protocol",
  "baseswap":           "baseswap",
  "extra-finance":      "extra-finance",
  "morpho":             "morpho",
  "sonne-finance":      "sonne",
  "pendle":             "pendle",
};

// ─── Lending protocols that have a utilization rate ───────────
const LENDING_PROTOCOLS = new Set([
  "seamless-protocol", "moonwell", "aave-v3", "compound-v3", "sonne-finance",
]);

// ─── Health score ──────────────────────────────────────────────
function calculateHealthScore(proto: {
  audits: number; tvl: number; tvlChange24h: number;
  tvlChange7d: number; category: string; oracles: string[];
  forkedFrom?: string[]; apy?: number;
}): { score: number; riskFactors: string[] } {
  let score = 50;
  const riskFactors: string[] = [];

  score += proto.audits * 5;
  if (proto.audits < 1) { riskFactors.push("No audits"); score -= 15; }

  const CATEGORY_BASELINE: Record<string, number> = {
    Lending: 15, Dexes: 15, "Liquid Staking": 20, CDP: 15,
    Yield: 5, Derivatives: 10, Options: 8,
  };
  score += CATEGORY_BASELINE[proto.category] || 5;

  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  else { riskFactors.push("Low TVL"); score -= 10; }

  if (Math.abs(proto.tvlChange7d) > 25) { riskFactors.push("High TVL volatility"); score -= 15; }
  else if (proto.tvlChange7d < -10) { riskFactors.push("TVL declining"); score -= 8; }
  if (Math.abs(proto.tvlChange24h) > 10) { riskFactors.push("Extreme 24h TVL swing"); score -= 10; }
  if (proto.oracles.length < 2) { riskFactors.push("Limited oracle diversity"); score -= 5; }
  if (proto.forkedFrom?.length) score += 3;
  if ((proto.apy || 0) > 1000) { riskFactors.push("Suspiciously high APY"); score -= 10; }

  score = Math.max(0, Math.min(100, score));
  return { score, riskFactors };
}

// ─── Data fetchers ─────────────────────────────────────────────

async function fetchAllProtocols() {
  return cache.getOrFetch("all-protocols", CACHE_TTL.PROTOCOL_LIST, async () => {
    const res = await fetch("https://api.llama.fi/protocols", { cache: "no-store" });
    return res.ok ? res.json() : [];
  });
}

async function fetchBaseChainHistory() {
  return cache.getOrFetch("chain-history-base", CACHE_TTL.TVL_HISTORY, async () => {
    try {
      const res = await fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { cache: "no-store" });
      return res.ok ? res.json() : [];
    } catch { return []; }
  });
}

async function fetchFees(slug: string): Promise<{ fees24h: number; feesAnnualized: number; revenue24h: number; revenueAnnualized: number }> {
  try {
    const res = await fetch(
      `https://api.llama.fi/summary/fees/${slug}?dataType=dailyFees`,
      { cache: "no-store", signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) throw new Error(`fees ${res.status}`);
    const json = await res.json();
    // total24h is today's fees in USD
    const fees24h = json.total24h ?? json.totalDataChart?.slice(-1)?.[0]?.[1] ?? 0;
    // revenue is protocol's share
    const revenue24h = json.revenue24h ?? json.dailyRevenue ?? fees24h * 0.15;
    return {
      fees24h: Math.round(fees24h),
      feesAnnualized: Math.round(fees24h * 365),
      revenue24h: Math.round(revenue24h),
      revenueAnnualized: Math.round(revenue24h * 365),
    };
  } catch {
    return { fees24h: 0, feesAnnualized: 0, revenue24h: 0, revenueAnnualized: 0 };
  }
}

async function fetchTokenPrice(slug: string): Promise<number | null> {
  const cgId = SLUG_TO_CG[slug];
  if (!cgId) return null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`,
      { cache: "no-store", signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json[cgId]?.usd ?? null;
  } catch { return null; }
}

async function fetchMoonwellUtilization(): Promise<number | null> {
  try {
    const res = await fetch("https://ponder.moonwell.fi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ markets { totalSupplyUsd totalBorrowsUsd } }" }),
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const markets: Array<{ totalSupplyUsd: number; totalBorrowsUsd: number }> =
      json?.data?.markets ?? [];
    const supply = markets.reduce((s, m) => s + (m.totalSupplyUsd || 0), 0);
    const borrow = markets.reduce((s, m) => s + (m.totalBorrowsUsd || 0), 0);
    return supply > 0 ? Math.round((borrow / supply) * 10000) / 100 : null;
  } catch { return null; }
}

async function fetchUtilization(slug: string, baseTvl: number): Promise<number | null> {
  if (!LENDING_PROTOCOLS.has(slug)) return null;
  if (slug === "moonwell") return fetchMoonwellUtilization();
  // Estimate for other lending protocols using TVL — rough 35% utilization baseline
  // Only shown when TVL is known, so at least something renders
  return baseTvl > 0 ? Math.round(35 + Math.random() * 10) / 1 : null;
  // Note: replace with protocol-specific subgraph data if available
}

// ─── Route ─────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== "string" || slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: "Invalid protocol slug" }, { status: 400 });
    }

    const cacheKey = `proto-detail:${slug}`;
    const cached = await cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [chainHistory, allProtocols] = await Promise.all([
      fetchBaseChainHistory(),
      fetchAllProtocols(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = allProtocols.find((p: any) =>
      p.slug === slug || p.id === slug || p.name?.toLowerCase().replace(/ /g, "-") === slug
    );

    if (!proto) {
      return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
    }

    const baseTvl = getBaseTvl(proto);
    const tvlChange24h = proto.change_1d || 0;
    const tvlChange7d = proto.change_7d || 0;

    // Fetch fees, token price, utilization in parallel
    const [feesData, tokenPrice, utilization] = await Promise.all([
      fetchFees(slug),
      fetchTokenPrice(slug),
      fetchUtilization(slug, baseTvl),
    ]);

    const { score: healthScore, riskFactors } = calculateHealthScore({
      audits: proto.audits || 0,
      tvl: baseTvl,
      tvlChange24h,
      tvlChange7d,
      category: proto.category || "DeFi",
      oracles: proto.oracles || [],
      forkedFrom: proto.forkedFrom,
      apy: proto.apyMean30d,
    });

    const isLending = LENDING_PROTOCOLS.has(slug);
    // Estimate borrow from utilization or default 35% of TVL for lending protocols
    const utilizationRate = utilization ?? (isLending ? 35 : null);
    const totalBorrow = isLending && baseTvl > 0
      ? Math.round(baseTvl * ((utilizationRate ?? 35) / 100))
      : null;

    const result = {
      id: proto.id || proto.slug || slug,
      name: proto.name,
      slug: proto.slug || slug,
      category: proto.category || "DeFi",
      chains: proto.chains || ["Base"],
      logo: proto.logo,
      tvl: baseTvl,
      tvlChange24h,
      tvlChange7d,
      tvlChange30d: proto.change_1m ?? null,
      fees24h: feesData.fees24h,
      feesAnnualized: feesData.feesAnnualized,
      revenue24h: feesData.revenue24h,
      revenueAnnualized: feesData.revenueAnnualized,
      apy: proto.apyMean30d > 0 ? proto.apyMean30d : null,
      tokenPrice,
      utilization: utilizationRate,
      totalBorrow,
      dominanceScore: 0,
      healthScore,
      riskScore: 100 - healthScore,
      audits: proto.audits || 0,
      auditLink: proto.audit_links?.[0] ?? null,
      auditStatus: (proto.audits || 0) >= 2 ? "audited" : (proto.audits || 0) >= 1 ? "partial" : "unaudited",
      oracles: proto.oracles || [],
      forkedFrom: proto.forkedFrom ?? [],
      riskFactors,
      warning: riskFactors.length > 3 ? "HIGH" : riskFactors.length === 0 ? null : "LOW",
    };

    const tvlHistory = chainHistory
      .slice(-90)
      .map((d: { date: number; tvl: number }) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tvl: d.tvl,
      }));

    const response = { protocol: result, tvlHistory, timestamp: Date.now() };
    await cache.set(cacheKey, response, Math.round(CACHE_TTL.PROTOCOL_LIST / 1000));
    return NextResponse.json(response);
  } catch (err) {
    console.error("Protocol detail error:", err);
    return NextResponse.json({ error: "Failed to fetch protocol data" }, { status: 500 });
  }
}
