import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { apiKeyMiddleware } from "@/lib/api-key";
import { apiError, apiErrorFromResponse, apiSuccess } from "@/lib/intelligence/api-response";
import { db } from "@/lib/db/client";
import { apiKeyUsage } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const auth = await apiKeyMiddleware(request, { required: true, endpoint: "v1-usage" });
  if (auth.response) return apiErrorFromResponse(auth.response, request);
  if (!auth.key) return apiError("api_key_required", "A valid API key is required.", 401, request);

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const keyId = auth.key.id;

    const [last24h] = await db
      .select({
        requests: count(),
        avgLatencyMs: sql<number>`avg(${apiKeyUsage.latencyMs})`,
      })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, oneDayAgo)));

    const [last7d] = await db
      .select({ requests: count() })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, sevenDaysAgo)));

    const endpoints = await db
      .select({ endpoint: apiKeyUsage.endpoint, requests: count() })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, oneDayAgo)))
      .groupBy(apiKeyUsage.endpoint)
      .orderBy(desc(count()))
      .limit(10);

    const statuses = await db
      .select({ status: apiKeyUsage.statusCode, requests: count() })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, oneDayAgo)))
      .groupBy(apiKeyUsage.statusCode);

    const dailyTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${apiKeyUsage.createdAt})::date::text`,
        requests: count(),
      })
      .from(apiKeyUsage)
      .where(and(eq(apiKeyUsage.keyId, keyId), gte(apiKeyUsage.createdAt, sevenDaysAgo)))
      .groupBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`)
      .orderBy(sql`date_trunc('day', ${apiKeyUsage.createdAt})`);

    const statusBreakdown = { success: 0, rateLimited: 0, clientError: 0, serverError: 0 };
    for (const row of statuses) {
      const code = Number(row.status);
      const requests = Number(row.requests);
      if (code >= 200 && code < 300) statusBreakdown.success += requests;
      else if (code === 429) statusBreakdown.rateLimited += requests;
      else if (code >= 400 && code < 500) statusBreakdown.clientError += requests;
      else if (code >= 500) statusBreakdown.serverError += requests;
    }

    const response = apiSuccess({
      key: {
        id: auth.key.id,
        name: auth.key.name,
        tier: auth.key.tier,
      },
      usage: {
        requests24h: Number(last24h?.requests ?? 0),
        requests7d: Number(last7d?.requests ?? 0),
        averageLatencyMs: Math.round(Number(last24h?.avgLatencyMs ?? 0)),
        endpoints: endpoints.map((row: { endpoint: string; requests: number | string }) => ({ endpoint: row.endpoint, requests: Number(row.requests) })),
        dailyTrend: dailyTrend.map((row: { date: string; requests: number | string }) => ({ date: row.date, requests: Number(row.requests) })),
        statusBreakdown,
      },
      limits: {
        requestsPerMinute: auth.key.rateLimit,
        requestsPer24h: Number(auth.rateLimitHeaders?.["X-Quota-Limit"] ?? 0),
        remainingPerMinute: Number(auth.rateLimitHeaders?.["X-RateLimit-Remaining"] ?? 0),
        remainingPer24h: Number(auth.rateLimitHeaders?.["X-Quota-Remaining"] ?? 0),
        resetPerMinuteSeconds: Number(auth.rateLimitHeaders?.["X-RateLimit-Reset"] ?? 0),
        resetPer24hSeconds: Number(auth.rateLimitHeaders?.["X-Quota-Reset"] ?? 0),
      },
    }, request, 200, auth.rateLimitHeaders);
    auth.trackUsage(200, Date.now() - startedAt, request);
    return response;
  } catch (error) {
    logger.error("Failed to read API key usage", {
      keyId: auth.key.id,
      error: error instanceof Error ? error.message : String(error),
    });
    auth.trackUsage(503, Date.now() - startedAt, request);
    return apiError("usage_analytics_unavailable", "Usage analytics are temporarily unavailable.", 503, request);
  }
}
