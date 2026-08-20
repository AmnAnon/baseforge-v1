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
import { scoreLlamaProtocol, toRiskLevel } from "@/lib/risk";
import { aggregateProtocols } from "@/lib/protocol-aggregator";

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
  const [protRes, tvlRes, aggregated] = await Promise.all([
    fetch(LLAMA_PROTOCOLS, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
    fetch(LLAMA_CHAIN_TVL, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
    aggregateProtocols().catch(() => null),
  ]);
  if (!protRes.ok || !tvlRes.ok) throw new Error("DefiLlama fetch failed");

  const rawProtocols: ProtocolDatum[] = await protRes.json();
  const tvlHistory: { date: number; tvl: number }[] = await tvlRes.json();
  const yields = await fetchYields();
  const aggBySlug = new Map(
    (aggregated?.protocols ?? []).map((p) => [p.slug, p]),
  );

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
    const apy = yields[id] || yields[p.name.toLowerCase().replace(/ /g, "-")] || 0;
    const agg = aggBySlug.get(id);
    const r = agg
      ? {
          health: agg.healthScore,
          risk: agg.riskScore,
          factors: agg.riskFactors.map((f) =>
            f.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
          ),
          level: toRiskLevel(agg.healthScore),
          audit: agg.auditStatus,
        }
      : scoreLlamaProtocol({
          audits: p.audits,
          change_1d: p.change_1d,
          change_7d: p.change_7d,
          category: p.category,
          oracles: p.oracles,
          forkedFrom: p.forkedFrom,
          apy,
          chainTvls: p.chainTvls,
        });
    return {
      id,
      name: p.name,
      cat: p.category,
      tvl: Math.round(p.chainTvls.Base || 0),
      c1d: r2(p.change_1d || 0),
      c7d: r2(p.change_7d || 0),
      c30d: p.change_1m !== undefined ? r2(p.change_1m) : undefined,
      apy: r2(apy),
      health: r.health,
      risk: r.risk,
      factors: r.factors,
      level: r.level,
      audit: r.audit,
      dom: r2(totalTvl > 0 ? ((p.chainTvls.Base || 0) / totalTvl) * 100 : 0),
      _riskEnriched: !!agg,
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

import crypto from "node:crypto";
import { validateWebhookUrl } from "@/lib/webhook-url";

const WebhookRequestSchema = z.object({
  include: z.string().optional().default("protocols,risk,market,whales,intent"),
  protocol: z.string().optional(),
  timeframe: z.enum(["1h", "6h", "24h"]).optional().default("24h"),
  top: z.coerce.number().int().min(1).max(50).optional().default(15),
  compact: z.enum(["true", "false"]).optional().default("false"),
  webhook_url: z.string().url(),
  webhook_secret: z.string().min(4).optional().default("baseforge-agent-secret"),
  event_type: z.string().optional().default("agent.context.dispatch"),
  filters: z
    .object({
      min_whale_usd: z.number().optional(),
      risk_level: z.enum(["all", "high", "medium", "low"]).optional().default("all"),
      min_tvl: z.number().optional(),
      anomaly_only: z.boolean().optional().default(false),
    })
    .optional(),
});

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
    const top = Math.min(params.top, topLimitForTier);

    const cacheKey = `agent-ctx-v3:${tier}:${params.include}:${params.protocol || "all"}:${params.timeframe}:${top}:${params.compact}`;
    const cached = await cache.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      end();
      return NextResponse.json(cached, {
        headers: responseHeaders("HIT", "cache", tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt),
      });
    }

    const response = await generateAgentContext({
      include: params.include,
      protocol: params.protocol,
      timeframe: params.timeframe,
      top,
      compact: params.compact,
      tier,
      rateLimitLimit,
      rateLimitRemaining,
      rateLimitResetAt,
      endTiming: end,
    });

    // Cache for 2 minutes
    await cache.set(cacheKey, response.data, 120);

    return NextResponse.json(response.data, {
      headers: responseHeaders(
        "MISS",
        response.source,
        tier,
        rateLimitLimit,
        rateLimitRemaining,
        rateLimitResetAt,
      ),
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
      {
        status: 200,
        headers: responseHeaders(
          "ERROR",
          "none",
          tier,
          rateLimitLimit,
          rateLimitRemaining,
          rateLimitResetAt,
        ),
      },
    );
  }
}

// ─── POST (Webhook Dispatch Mode) ────────────────────────────────────────

export async function POST(req: Request) {
  let tier = "public";
  let rateLimitLimit = 20;
  let rateLimitRemaining = 19;
  let rateLimitResetAt = Date.now() + 60_000;

  const providedKey = req.headers.get("x-api-key");
  if (providedKey) {
    const authResult = await apiKeyMiddleware(req, {
      required: false,
      endpoint: "/api/agents/context/webhook",
    });
    if (authResult.key) {
      tier = authResult.key.tier;
      rateLimitLimit = authResult.key.rateLimit;
    }
  }

  const end = timing("agents.context.webhook");

  try {
    const body = await req.json();
    const parsed = WebhookRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request_body", details: parsed.error.format() },
        { status: 400, headers: responseHeaders("MISS", "none", tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt) },
      );
    }

    const {
      webhook_url,
      webhook_secret,
      event_type,
      include,
      protocol,
      timeframe,
      top,
      compact,
      filters,
    } = parsed.data;

    // SSRF Validation
    const urlCheck = await validateWebhookUrl(webhook_url);
    if (!urlCheck.ok) {
      return NextResponse.json(
        { error: "ssrf_protection_triggered", details: urlCheck.error },
        { status: 400, headers: responseHeaders("MISS", "none", tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt) },
      );
    }

    // Generate Agent Context
    const { data: contextData, source } = await generateAgentContext({
      include,
      protocol,
      timeframe,
      top: Math.min(top, TOP_LIMITS[tier] ?? 20),
      compact,
      tier,
      rateLimitLimit,
      rateLimitRemaining,
      rateLimitResetAt,
      endTiming: end,
    });

    // Apply optional webhook filtering
    let shouldDispatch = true;
    let skipReason: string | null = null;

    if (filters) {
      if (filters.anomaly_only) {
        const anomalies = (contextData.risk as { anomalies?: unknown[] })?.anomalies || [];
        if (anomalies.length === 0) {
          shouldDispatch = false;
          skipReason = "no_anomalies_detected";
        }
      }

      if (filters.min_whale_usd && contextData.whales) {
        const whales = contextData.whales as { flows?: Array<{ usd?: number }> };
        if (whales.flows) {
          whales.flows = whales.flows.filter((f) => (f.usd ?? 0) >= (filters.min_whale_usd ?? 0));
        }
      }

      if (filters.risk_level && filters.risk_level !== "all" && Array.isArray(contextData.protocols)) {
        contextData.protocols = contextData.protocols.filter(
          (p: { level?: string }) => p.level?.toLowerCase() === filters.risk_level?.toLowerCase(),
        );
      }
    }

    if (!shouldDispatch) {
      return NextResponse.json({
        ok: true,
        dispatched: false,
        reason: skipReason,
        webhookUrl: webhook_url,
        context: contextData,
      });
    }

    // Construct Webhook Dispatch Payload & HMAC Signature
    const timestamp = Date.now();
    const webhookPayload = {
      event: event_type,
      timestamp,
      iso: new Date(timestamp).toISOString(),
      source: "baseforge.agent.webhook.v2",
      context: contextData,
    };

    const payloadString = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac("sha256", webhook_secret)
      .update(payloadString)
      .digest("hex");

    const dispatchStart = Date.now();
    let deliveryStatus = 0;
    let deliveryError: string | null = null;

    try {
      const dispatchRes = await fetch(urlCheck.url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BaseForge-Agent-Webhook/2.0",
          "X-BaseForge-Event": event_type,
          "X-BaseForge-Timestamp": String(timestamp),
          "X-BaseForge-Signature": `sha256=${signature}`,
        },
        body: payloadString,
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });

      deliveryStatus = dispatchRes.status;
      if (!dispatchRes.ok) {
        deliveryError = `Remote webhook receiver responded with HTTP ${dispatchRes.status}`;
      }
    } catch (dispatchErr) {
      deliveryError = dispatchErr instanceof Error ? dispatchErr.message : "Network error";
    }

    const deliveryLatencyMs = Date.now() - dispatchStart;

    return NextResponse.json(
      {
        ok: !deliveryError,
        dispatched: true,
        delivery: {
          status: deliveryStatus,
          error: deliveryError,
          latencyMs: deliveryLatencyMs,
          signature: `sha256=${signature}`,
          timestamp,
        },
        webhookUrl: webhook_url,
        context: contextData,
      },
      {
        status: deliveryError ? 502 : 200,
        headers: responseHeaders("MISS", source, tier, rateLimitLimit, rateLimitRemaining, rateLimitResetAt),
      },
    );
  } catch (err) {
    end();
    logger.error("Agent context webhook error", { err: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      { error: "webhook_dispatch_failed", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, Authorization",
    },
  });
}

// ─── Shared Agent Context Builder ────────────────────────────────────────

interface ContextBuilderOptions {
  include: string;
  protocol?: string;
  timeframe: "1h" | "6h" | "24h";
  top: number;
  compact: "true" | "false";
  tier: string;
  rateLimitLimit: number;
  rateLimitRemaining: number;
  rateLimitResetAt: number;
  endTiming: () => number;
}

async function generateAgentContext(options: ContextBuilderOptions) {
  const sections = parseInclude(options.include);
  const isCompact = options.compact === "true";

  const { protocols, totalTvl, totalProtocols, allEvaluated } =
    await buildProtocolSection(options.top, options.protocol);

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

  const now = Date.now();
  const response: Record<string, unknown> = {
    _v: "2.0",
    _schema: "baseforge.agent.context",
    _ts: now,
    _iso: new Date(now).toISOString(),
    _chain: "base",
    _chainId: 8453,
    _source: healthData?.activeProvider || "defillama",
    _riskMethod: "canonical_v1",
    _riskNote: "Health scores use calculateHealthScore; aerodrome/uniswap-v3 include on-chain indexer enrichment when available.",
    _latencyMs: 0,
    _tier: options.tier,
    _rateLimit: {
      limit: options.rateLimitLimit,
      remaining: options.rateLimitRemaining,
      resetAt: new Date(options.rateLimitResetAt).toISOString(),
    },
    _params: {
      include: Array.from(sections),
      protocol: options.protocol || null,
      timeframe: options.timeframe,
      top: options.top,
    },
  };

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

  if (sections.has("protocols")) {
    response.protocols = isCompact
      ? protocols.map(({ id, tvl, c1d, c7d, health, level }) => ({ id, tvl, c1d, c7d, health, level }))
      : protocols;
  }

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

  if (sections.has("mev")) {
    response.mev = {
      status: "heuristic",
      confidence: 0.3,
      note: "MEV detection uses tx-size heuristics. EigenPhi integration planned for labeled data.",
      estimatedExtraction24h: 0,
      sandwichCount: 0,
      arbitrageCount: 0,
    };
  }

  if (sections.has("gas") && gasData) {
    response.gas = gasData;
  }

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

  const latencyMs = Math.round(options.endTiming());
  response._latencyMs = latencyMs;
  response._ttl = 120;
  response._next = new Date(now + 120_000).toISOString();

  return {
    data: response,
    source: healthData?.activeProvider || "defillama",
  };
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
