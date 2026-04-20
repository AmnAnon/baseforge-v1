// src/app/api/agents/context/route.ts
// AI Agent Context v2 — compressed, structured, high-signal intelligence
// about Base DeFi protocols for LLM consumption.
//
// Design principles:
// 1. Token-efficient — short keys, no redundant nesting
// 2. Deterministic schema — same shape every time, Zod-validated
// 3. Filterable — ?include=whales,risk,mev&protocol=aerodrome&timeframe=24h
// 4. Self-describing — includes schema version, timestamps, confidence, data source
// 5. Actionable — anomalies, intent signals, risk breakdowns, not raw data dumps
//
// Typical response: ~3-6KB JSON depending on include params (~800-1500 tokens)

import { NextResponse } from "next/server";
import { z } from "zod";
import { cache } from "@/lib/cache";
import { RateLimiter, rateLimiterMiddleware } from "@/lib/rate-limit";
import { apiKeyMiddleware } from "@/lib/api-key";
import { logger, timing } from "@/lib/logger";
import { getWhaleFlows, getLendingActivity, getIndexerHealth } from "@/lib/data/indexers";
import { computeIntentSignals, type IntentProtocol } from "@/lib/intent-engine";

// ─── Agent-specific rate limiter (20 req/min — more generous for bots) ──

const agentRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 20 });

// ─── External Data Sources ──────────────────────────────────────────────

const LLAMA_PROTOCOLS = "https://api.llama.fi/protocols";
const LLAMA_CHAIN_TVL = "https://api.llama.fi/v2/historicalChainTvl/Base";
const LLAMA_YIELDS = "https://yields.llama.fi/pools?chain=Base";
const COINGECKO_ETH = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true";
const EXCLUDED = new Set(["CEX", "Chain", "Bridge", "Liquidity Manager", "RWA"]);

// ─── Query parameter schema ────────────────────────────────────────────

const QuerySchema = z.object({
  include: z.string().optional().default("protocols,risk,market"),
  protocol: z.string().optional(),
  timeframe: z.enum(["1h", "6h", "24h"]).optional().default("24h"),
  top: z.coerce.number().int().min(1).max(50).optional().default(15),
  compact: z.enum(["true", "false"]).optional().default("false"),
});

type IncludeSection = "protocols" | "risk" | "market" | "whales" | "mev" | "gas" | "lending" | "intent";

function parseInclude(raw: string): Set<IncludeSection> {
  const valid = new Set<IncludeSection>(["protocols", "risk", "market", "whales", "mev", "gas", "lending", "intent"]);
  if (raw === "all") return valid;
  const parts = raw.split(",").map((s) => s.trim().toLowerCase()) as IncludeSection[];
  return new Set(parts.filter((p) => valid.has(p)));
}

// ─── Types ──────────────────────────────────────────────────────────────

interface ProtocolDatum {
  name: string;
  slug?: string;
  audits: number;
  category: string;
  change_1d?: number;
  change_7d: number;
  change_1m?: number;
  oracles?: string[];
  forkedFrom?: string[];
  chainTvls: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
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
    level: (risk > 50 ? "high" : risk > 30 ? "medium" : "low") as "high" | "medium" | "low",
    audit: (audits >= 2 ? "audited" : audits >= 1 ? "partial" : "unaudited") as "audited" | "partial" | "unaudited",
  };
}

async function fetchYields(): Promise<Record<string, number>> {
  try {
    const res = await fetch(LLAMA_YIELDS, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
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

async function fetchGasData(): Promise<{
  baseFeeGwei: number;
  congestion: "low" | "medium" | "high";
  estTxCostUSD: number;
}> {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) return { baseFeeGwei: 0.001, congestion: "low", estTxCostUSD: 0.001 };

    const [gasRes, priceRes] = await Promise.all([
      fetch(`https://api.etherscan.io/v2/api?chainid=8453&module=proxy&action=eth_gasPrice&apikey=${apiKey}`, {
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(COINGECKO_ETH, { signal: AbortSignal.timeout(5_000) }),
    ]);

    let baseFeeWei = 1_000_000;
    if (gasRes.ok) {
      const gj = await gasRes.json();
      if (gj.result && gj.result !== "0x") baseFeeWei = parseInt(gj.result, 16);
    }

    let ethPrice = 2500;
    if (priceRes.ok) {
      const pj = await priceRes.json();
      ethPrice = pj?.ethereum?.usd || 2500;
    }

    const baseFeeGwei = baseFeeWei / 1e9;
    const congestion: "low" | "medium" | "high" =
      baseFeeGwei > 0.01 ? "high" : baseFeeGwei > 0.002 ? "medium" : "low";
    const estTxCostUSD = r2(((baseFeeWei + 100_000) * 21_000) / 1e18 * ethPrice);

    return { baseFeeGwei: r2(baseFeeGwei), congestion, estTxCostUSD };
  } catch {
    return { baseFeeGwei: 0.001, congestion: "low", estTxCostUSD: 0.001 };
  }
}

// ─── Build context sections ─────────────────────────────────────────────

async function buildProtocolSection(
  top: number,
  protocolFilter?: string,
): Promise<{
  protocols: Array<Record<string, unknown>>;
  totalTvl: number;
  totalProtocols: number;
  yields: Record<string, number>;
  allEvaluated: Array<{
    id: string; name: string; cat: string; tvl: number;
    c1d: number; c7d: number; apy: number;
    health: number; risk: number; level: string; audit: string;
    factors: string[]; dom: number;
  }>;
}> {
  const [protRes, tvlRes] = await Promise.all([
    fetch(LLAMA_PROTOCOLS, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
    fetch(LLAMA_CHAIN_TVL, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!protRes.ok || !tvlRes.ok) throw new Error("DefiLlama fetch failed");

  const rawProtocols: ProtocolDatum[] = await protRes.json();
  const tvlHistory: { date: number; tvl: number }[] = await tvlRes.json();
  const yields = await fetchYields();

  let filtered = rawProtocols
    .filter((p) => (p.chainTvls?.Base || 0) > 0 && !EXCLUDED.has(p.category))
    .sort((a, b) => (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0));

  const totalTvl = filtered.reduce((s, p) => s + (p.chainTvls.Base || 0), 0);

  if (protocolFilter) {
    const pf = protocolFilter.toLowerCase();
    filtered = filtered.filter((p) => {
      const slug = p.slug || p.name.toLowerCase().replace(/ /g, "-");
      return slug.includes(pf) || p.name.toLowerCase().includes(pf) || p.category.toLowerCase() === pf;
    });
  }

  const evaluated = filtered.slice(0, Math.max(top, 50)).map((p) => {
    const id = p.slug || p.name.toLowerCase().replace(/ /g, "-");
    const r = computeRisk(p, totalTvl);
    const apy = yields[id] || yields[p.name.toLowerCase().replace(/ /g, "-")] || 0;
    return {
      id, name: p.name, cat: p.category,
      tvl: Math.round(p.chainTvls.Base || 0),
      c1d: r2(p.change_1d || 0),
      c7d: r2(p.change_7d || 0),
      c30d: p.change_1m !== undefined ? r2(p.change_1m) : undefined,
      apy: r2(apy),
      ...r,
      dom: r2(totalTvl > 0 ? ((p.chainTvls.Base || 0) / totalTvl) * 100 : 0),
    };
  });

  const topN = evaluated.slice(0, top);

  // TVL trend
  const recent30 = tvlHistory.slice(-30).map((d) => d.tvl);
  let tvlTrendPct = 0;
  if (recent30.length >= 2) {
    tvlTrendPct = r2(((recent30[recent30.length - 1] - recent30[0]) / (recent30[0] || 1)) * 100);
  }

  const protocols = topN.map((p) => ({
    id: p.id, name: p.name, cat: p.cat, tvl: p.tvl,
    c1d: p.c1d, c7d: p.c7d, ...(p.c30d !== undefined ? { c30d: p.c30d } : {}),
    apy: p.apy, dom: p.dom,
    health: p.health, risk: p.risk, level: p.level, audit: p.audit,
    factors: p.factors,
  }));

  return { protocols, totalTvl, totalProtocols: filtered.length, yields, allEvaluated: evaluated };
}

// ─── Per-tier top-protocol limits ────────────────────────────────────────

const TOP_LIMITS: Record<string, number> = {
  public: 5,
  free: 20,
  pro: 50,
  enterprise: 50,
};

// ─── IP rate limiter for public (unauthenticated) requests ───────────────

const publicRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 });

// ─── GET ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // ── Tiered auth ─────────────────────────────────────────────
  let tier = "public";
  let rateLimitLimit = 10;
  let rateLimitRemaining = 0;
  let rateLimitResetAt = Date.now() + 60_000;

  const providedKey = req.headers.get("x-api-key");

  if (!providedKey) {
    // Public tier — IP rate limited, no key required
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const result = publicRateLimiter.check(`public:${ip}`);
    rateLimitLimit = 10;
    rateLimitRemaining = result.remaining ?? 0;
    rateLimitResetAt = result.retryAfter ? Date.now() + result.retryAfter * 1000 : Date.now() + 60_000;

    if (!result.allowed) {
      return Response.json(
        {
          error: "rate_limit_exceeded",
          hint: "Get a free API key at /api/admin/api-keys for higher limits",
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter ?? 60),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
  } else {
    // Keyed tier — validate from DB
    const authResult = await apiKeyMiddleware(req, {
      required: true,
      endpoint: "/api/agents/context",
    });
    if (authResult.response) return authResult.response;

    tier = authResult.key?.tier ?? "free";
    rateLimitLimit = authResult.key?.rateLimit ?? 100;

    // Secondary IP-based limiter still applies in production
    const rateResponse = await rateLimiterMiddleware(agentRateLimiter)(req);
    if (rateResponse) return rateResponse;
  }

  const topLimitForTier = TOP_LIMITS[tier] ?? TOP_LIMITS.free;

  const end = timing("agents.context");

  try {
    const url = new URL(req.url);
    const rawParams = {
      include: url.searchParams.get("include") || undefined,
      protocol: url.searchParams.get("protocol") || undefined,
      timeframe: url.searchParams.get("timeframe") || undefined,
      top: url.searchParams.get("top") || undefined,
      compact: url.searchParams.get("compact") || undefined,
    };
    const params = QuerySchema.parse(rawParams);
    const sections = parseInclude(params.include);
    const isCompact = params.compact === "true";

    // Clamp `top` to the tier's maximum
    const top = Math.min(params.top, topLimitForTier);

    // Cache key includes tier so public/free/pro get separate cached payloads
    const cacheKey = `agent-ctx-v3:${tier}:${params.include}:${params.protocol || "all"}:${params.timeframe}:${top}:${params.compact}`;
    const cached = await cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      end();
      return NextResponse.json(cached, {
        headers: responseHeaders("HIT", "cache", tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt),
      });
    }

    // ── Build response in parallel ──────────────────────────

    const { protocols, totalTvl, totalProtocols, allEvaluated } =
      await buildProtocolSection(top, params.protocol);

    // Parallel data fetches for optional sections
    const [whaleResult, lendingResult, gasResult, indexerHealth] = await Promise.allSettled([
      sections.has("whales") || sections.has("intent")
        ? getWhaleFlows({ minAmountUSD: 50_000, limit: 30 })
        : Promise.resolve(null),
      sections.has("lending")
        ? getLendingActivity({ limit: 20 })
        : Promise.resolve(null),
      sections.has("gas")
        ? fetchGasData()
        : Promise.resolve(null),
      getIndexerHealth(),
    ]);

    const whaleData = whaleResult.status === "fulfilled" ? whaleResult.value : null;
    const lendingData = lendingResult.status === "fulfilled" ? lendingResult.value : null;
    const gasData = gasResult.status === "fulfilled" ? gasResult.value : null;
    const healthData = indexerHealth.status === "fulfilled" ? indexerHealth.value : null;

    // ── Assemble response ───────────────────────────────────

    const now = Date.now();
    const response: Record<string, unknown> = {
      _v: "2.0",
      _schema: "baseforge.agent.context",
      _ts: now,
      _iso: new Date(now).toISOString(),
      _chain: "base",
      _chainId: 8453,
      _source: healthData?.activeProvider || "defillama",
      _latencyMs: 0, // filled at end
      _tier: tier,
      _rateLimit: {
        limit: rateLimitLimit,
        remaining: rateLimitRemaining,
        resetAt: new Date(rateLimitResetAt).toISOString(),
      },
      _params: {
        include: Array.from(sections),
        protocol: params.protocol || null,
        timeframe: params.timeframe,
        top,
      },
    };

    // ── Market overview (always included) ───────────────────

    if (sections.has("market") || sections.has("protocols")) {
      const avgHealth = allEvaluated.length > 0
        ? Math.round(allEvaluated.reduce((s, p) => s + p.health, 0) / allEvaluated.length)
        : 0;
      const avgApy = allEvaluated.length > 0
        ? r2(allEvaluated.reduce((s, p) => s + p.apy, 0) / allEvaluated.length)
        : 0;
      const recent30 = allEvaluated.slice(0, 30);
      const tvlTrendPct = totalTvl > 0 && recent30.length > 0
        ? r2(recent30.reduce((s, p) => s + p.c7d, 0) / recent30.length)
        : 0;

      response.market = {
        totalTvl,
        protocols: totalProtocols,
        avgApy,
        avgHealth,
        tvlTrend: tvlTrendPct > 5 ? "up" : tvlTrendPct < -5 ? "down" : "flat",
        tvlTrendPct,
        topCategory: getMostCommonCategory(allEvaluated.slice(0, 20)),
      };
    }

    // ── Protocols ───────────────────────────────────────────

    if (sections.has("protocols")) {
      response.protocols = isCompact
        ? protocols.map(({ id, tvl, c1d, c7d, health, level }) => ({ id, tvl, c1d, c7d, health, level }))
        : protocols;
    }

    // ── Risk breakdown ──────────────────────────────────────

    if (sections.has("risk")) {
      const highRisk = allEvaluated.filter((p) => p.level === "high");
      const unaudited = allEvaluated.filter((p) => p.audit === "unaudited");
      const topProto = allEvaluated[0];

      const anomalies: Array<{ id: string; reason: string; severity: string }> = [];
      for (const p of allEvaluated.slice(0, 20)) {
        if (p.c7d < -20) anomalies.push({ id: p.id, reason: "sharp_tvl_decline", severity: "high" });
        if (p.c7d > 50) anomalies.push({ id: p.id, reason: "rapid_tvl_growth", severity: "medium" });
        if (p.level === "high" && p.tvl > 5_000_000)
          anomalies.push({ id: p.id, reason: "high_risk_high_tvl", severity: "high" });
      }

      response.risk = {
        avgHealth: Math.round(allEvaluated.reduce((s, p) => s + p.health, 0) / (allEvaluated.length || 1)),
        highRiskCount: highRisk.length,
        highRiskProtocols: highRisk.slice(0, 5).map((p) => p.id),
        unauditedCount: unaudited.length,
        concentration: {
          level: topProto && topProto.dom > 30 ? "HIGH" : topProto && topProto.dom > 15 ? "MEDIUM" : "LOW",
          dominant: topProto?.name || "N/A",
          dominantPct: topProto?.dom || 0,
          hhi: r2(allEvaluated.slice(0, 20).reduce((s, p) => s + (p.dom / 100) ** 2, 0) * 10000),
        },
        anomalies,
        confidence: anomalies.length === 0 ? 0.9 : anomalies.some((a) => a.severity === "high") ? 0.6 : 0.75,
      };
    }

    // ── Whale flows ─────────────────────────────────────────

    if (sections.has("whales") && whaleData) {
      const flows = whaleData.flows.slice(0, isCompact ? 10 : 20);
      response.whales = {
        flows: flows.map((f) => ({
          tx: f.txHash.slice(0, 10),
          protocol: f.protocol,
          type: f.type,
          usd: f.amountUSD,
          token: f.token,
          amount: f.tokenAmount,
          from: f.from.slice(0, 10),
          to: f.to.slice(0, 10),
          block: f.blockNumber,
        })),
        summary: whaleData.summary,
        count: whaleData.flows.length,
        source: whaleData.source,
      };
    }

    // ── Lending activity ────────────────────────────────────

    if (sections.has("lending") && lendingData) {
      response.lending = {
        events: lendingData.events.slice(0, isCompact ? 5 : 15).map((e) => ({
          tx: e.txHash.slice(0, 10),
          action: e.action,
          protocol: e.protocol,
          asset: e.asset.slice(0, 10),
          usd: e.amountUSD,
          user: e.user.slice(0, 10),
        })),
        summary: lendingData.summary,
        source: lendingData.source,
      };
    }

    // ── MEV signals (heuristic) ─────────────────────────────

    if (sections.has("mev")) {
      // MEV is still heuristic-based — flag as low confidence
      response.mev = {
        status: "heuristic",
        confidence: 0.3,
        note: "MEV detection uses tx-size heuristics. EigenPhi integration planned for labeled data.",
        estimatedExtraction24h: 0,
        sandwichCount: 0,
        arbitrageCount: 0,
      };
    }

    // ── Gas ─────────────────────────────────────────────────

    if (sections.has("gas") && gasData) {
      response.gas = gasData;
    }

    // ── Intent signals ──────────────────────────────────────

    if (sections.has("intent")) {
      const intentProtos: IntentProtocol[] = allEvaluated.map((p) => ({
        id: p.id,
        name: p.name,
        c1d: p.c1d,
        c7d: p.c7d,
        tvl: p.tvl,
        level: p.level,
      }));
      const intents = await computeIntentSignals(intentProtos);
      if (intents.length > 0) {
        response.intents = intents;
      }
    }

    // ── Metadata footer ─────────────────────────────────────

    const latencyMs = Math.round(end());
    response._latencyMs = latencyMs;
    response._ttl = 120;
    response._next = new Date(now + 120_000).toISOString();

    // Cache for 2 minutes
    await cache.set(cacheKey, response, 120);

    return NextResponse.json(response, {
      headers: responseHeaders("MISS", healthData?.activeProvider || "defillama", tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt),
    });
  } catch (err) {
    end();
    logger.error("Agent context v2 error", { err: err instanceof Error ? err.message : "unknown" });

    return NextResponse.json(
      {
        _v: "2.0",
        _schema: "baseforge.agent.context",
        _ts: Date.now(),
        _chain: "base",
        _error: "context_build_failed",
        market: { totalTvl: 0, protocols: 0, avgApy: 0, avgHealth: 0 },
        protocols: [],
        risk: { avgHealth: 0, highRiskCount: 0, anomalies: [] },
        _stale: true,
      },
      { status: 200, headers: responseHeaders("ERROR", "none", tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt) }
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function responseHeaders(
  cacheStatus: string,
  source: string,
  tier: string,
  rateLimitLimit: number,
  rateLimitRemaining: number,
  rateLimitResetAt: number,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Content-Type": "baseforge.agent.context.v2",
    "X-Data-Source": source,
    "X-Cache-Status": cacheStatus,
    "Cache-Control": cacheStatus === "HIT"
      ? "public, max-age=120, stale-while-revalidate=300"
      : "public, max-age=0, stale-while-revalidate=300",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "X-RateLimit-Tier": tier,
    "X-RateLimit-Limit": String(rateLimitLimit),
    "X-RateLimit-Remaining": String(rateLimitRemaining),
    "X-RateLimit-Reset": new Date(rateLimitResetAt).toISOString(),
  };
}

function getMostCommonCategory(protocols: Array<{ cat: string }>): string {
  const counts: Record<string, number> = {};
  for (const p of protocols) {
    counts[p.cat] = (counts[p.cat] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";
}

export const dynamic = "force-dynamic";
