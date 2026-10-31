// src/app/api/agents/stats/route.ts
// Public API usage statistics & agent telemetry endpoint.
// Exposes API key counts, request volumes, status code breakdowns, and SDK adoption.

import { NextResponse } from "next/server";
import { sql, count, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiKeys, apiKeyUsage } from "@/lib/db/schema";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

interface StatsResponse {
  _v: string;
  _schema: string;
  _ts: number;
  _iso: string;
  overview: {
    totalApiKeys: number;
    activeKeys24h: number;
    requests24h: number;
    requestsTotal: number;
    avgLatencyMs: number;
    successRatePct: number;
  };
  keysByTier: {
    free: number;
    pro: number;
    enterprise: number;
  };
  dailyTrend: Array<{
    date: string;
    requests: number;
    activeKeys: number;
  }>;
  endpoints: Array<{
    endpoint: string;
    requests: number;
    pct: number;
  }>;
  statusBreakdown: {
    success: number;
    rateLimited: number;
    clientError: number;
    serverError: number;
  };
  agentClients: Array<{
    client: string;
    requests: number;
  }>;
  _source: "postgres" | "cached";
}

const CACHE_KEY = "agent_usage_stats_v1";
const CACHE_TTL_SECONDS = 60;

export async function GET() {
  try {
    const cached = await cache.get<StatsResponse>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(
        { ...cached, _source: "cached" },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Status": "HIT",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const stats = await computeStats();
    await cache.set(CACHE_KEY, stats, CACHE_TTL_SECONDS);

    return NextResponse.json(stats, {
      headers: {
        "Content-Type": "application/json",
        "X-Cache-Status": "MISS",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    logger.warn("Failed to compute agent API stats", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "usage_analytics_unavailable", message: "Usage analytics are temporarily unavailable." },
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Status": "UNAVAILABLE",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

async function computeStats(): Promise<StatsResponse> {
  const now = Date.now();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // 1. Total keys and tier distribution
  const keyRows = await db
    .select({
      tier: apiKeys.tier,
      total: count(),
    })
    .from(apiKeys)
    .where(sql`${apiKeys.enabled} = true AND ${apiKeys.revokedAt} IS NULL`)
    .groupBy(apiKeys.tier);

  const keysByTier = { free: 0, pro: 0, enterprise: 0 };
  let totalApiKeys = 0;
  for (const row of keyRows) {
    const t = (row.tier || "free") as keyof typeof keysByTier;
    const c = Number(row.total);
    if (t in keysByTier) keysByTier[t] = c;
    totalApiKeys += c;
  }

  // 2. 24h & total requests from usage table
  const [totalUsageRow] = await db
    .select({
      total: count(),
      avgLatency: sql<number>`avg(${apiKeyUsage.latencyMs})`,
    })
    .from(apiKeyUsage);

  const [usage24hRow] = await db
    .select({
      total: count(),
      uniqueKeys: sql<number>`count(distinct ${apiKeyUsage.keyId})`,
      avgLatency: sql<number>`avg(${apiKeyUsage.latencyMs})`,
    })
    .from(apiKeyUsage)
    .where(gte(apiKeyUsage.createdAt, oneDayAgo));

  const requestsTotal = Number(totalUsageRow?.total ?? 0);
  const requests24h = Number(usage24hRow?.total ?? 0);
  const activeKeys24h = Number(usage24hRow?.uniqueKeys ?? 0);
  const avgLatencyMs = Math.round(Number(usage24hRow?.avgLatency ?? totalUsageRow?.avgLatency ?? 0));

  // 3. 7-day daily trend
  const dailyRows = await db
    .select({
      date: sql<string>`date_trunc('day', ${apiKeyUsage.createdAt})::date::text`,
      requests: count(),
      activeKeys: sql<number>`count(distinct ${apiKeyUsage.keyId})`,
    })
    .from(apiKeyUsage)
    .where(gte(apiKeyUsage.createdAt, sevenDaysAgo))
    .groupBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`)
    .orderBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`);

  const dailyTrend = dailyRows.map((r: { date: string; requests: number | string; activeKeys: number | string }) => ({
    date: r.date,
    requests: Number(r.requests),
    activeKeys: Number(r.activeKeys),
  }));

  // 4. Endpoint distribution
  const endpointRows = await db
    .select({
      endpoint: apiKeyUsage.endpoint,
      requests: count(),
    })
    .from(apiKeyUsage)
    .groupBy(apiKeyUsage.endpoint)
    .orderBy(desc(count()))
    .limit(8);

  const totalLoggedEndpoints = endpointRows.reduce((s: number, r: { requests: number | string }) => s + Number(r.requests), 0) || 1;
  const endpoints = endpointRows.map((r: { endpoint: string; requests: number | string }) => ({
    endpoint: r.endpoint,
    requests: Number(r.requests),
    pct: Math.round((Number(r.requests) / totalLoggedEndpoints) * 100),
  }));

  // 5. Status code breakdown
  const statusRows = await db
    .select({
      status: apiKeyUsage.statusCode,
      count: count(),
    })
    .from(apiKeyUsage)
    .where(gte(apiKeyUsage.createdAt, oneDayAgo))
    .groupBy(apiKeyUsage.statusCode);

  const statusBreakdown = {
    success: 0,
    rateLimited: 0,
    clientError: 0,
    serverError: 0,
  };

  for (const row of statusRows) {
    const code = Number(row.status);
    const cnt = Number(row.count);
    if (code >= 200 && code < 300) statusBreakdown.success += cnt;
    else if (code === 429) statusBreakdown.rateLimited += cnt;
    else if (code >= 400 && code < 500) statusBreakdown.clientError += cnt;
    else if (code >= 500) statusBreakdown.serverError += cnt;
  }

  const successTotal = statusBreakdown.success + statusBreakdown.rateLimited + statusBreakdown.clientError + statusBreakdown.serverError;
  const successRatePct = successTotal > 0 ? Math.round((statusBreakdown.success / successTotal) * 100) : 0;

  // 6. User Agent / SDK Distribution
  const clientRows = await db
    .select({
      ua: apiKeyUsage.userAgent,
      requests: count(),
    })
    .from(apiKeyUsage)
    .where(sql`${apiKeyUsage.userAgent} IS NOT NULL`)
    .groupBy(apiKeyUsage.userAgent)
    .orderBy(desc(count()))
    .limit(6);

  const agentClients = clientRows.map((r: { ua: string | null; requests: number | string }) => {
    let name = "Custom HTTP Client";
    const ua = r.ua || "";
    if (ua.includes("BaseForge-Python-SDK")) name = "BaseForge Python SDK";
    else if (ua.includes("BaseForge-MCP")) name = "BaseForge MCP Server";
    else if (ua.includes("Claude") || ua.includes("Anthropic")) name = "Claude Agent";
    else if (ua.includes("LangChain")) name = "LangChain Agent";
    else if (ua.includes("CrewAI")) name = "CrewAI Agent";
    else if (ua.includes("curl")) name = "cURL CLI";
    else if (ua.includes("Mozilla") || ua.includes("Chrome")) name = "Web Dashboard";

    return {
      client: name,
      requests: Number(r.requests),
    };
  });

  return {
    _v: "2.0",
    _schema: "baseforge.agent.stats",
    _ts: now,
    _iso: new Date(now).toISOString(),
    overview: {
      totalApiKeys,
      activeKeys24h,
      requests24h,
      requestsTotal,
      avgLatencyMs,
      successRatePct,
    },
    keysByTier,
    dailyTrend,
    endpoints,
    statusBreakdown,
    agentClients,
    _source: "postgres",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
    },
  });
}

export const dynamic = "force-dynamic";
