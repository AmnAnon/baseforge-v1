// src/lib/api-key.ts
// API key authentication + per-key rate limiting middleware.
//
// Usage in route handlers:
//   const authResult = await apiKeyMiddleware(req, { required: true, tier: "free" });
//   if (authResult.response) return authResult.response;
//
// Keys are passed via:
//   - X-API-Key header (preferred)
//   - ?apiKey= query parameter (fallback for curl/browser)
//
// Keys are stored as SHA-256 hashes in Postgres. The raw key is only
// shown once at creation time.

import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "./db/client";
import { apiKeys, apiKeyUsage, NewApiKey, NewApiKeyUsage } from "./db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";

// ─── Config ──────────────────────────────────────────────────────

const DEFAULT_RATE_LIMITS = {
  free: 100,
  pro: 1000,
  enterprise: 10000,
} as const;

// ─── Key generation ──────────────────────────────────────────────

/**
 * Generate a new API key pair. Returns the raw key (shown once)
 * and the hash (stored in DB).
 */
export function generateApiKey(): { raw: string; hash: string } {
  const raw = `bf_${randomBytes(32).toString("hex")}`;
  const hash = sha256(raw);
  return { raw, hash };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Create a new API key in the database.
 */
export async function createApiKeyInDb(
  name: string,
  tier: "free" | "pro" | "enterprise" = "free",
  customRateLimit?: number
): Promise<{ raw: string; record: ApiKeyRecord }> {
  const { raw, hash } = generateApiKey();
  const rateLimit = customRateLimit ?? DEFAULT_RATE_LIMITS[tier];

  const [inserted] = await db
    .insert(apiKeys)
    .values({ key: hash, name, tier, rateLimit, enabled: true, totalRequests: 0 })
    .returning();

  const record: ApiKeyRecord = {
    id: inserted.id,
    key: inserted.key,
    name: inserted.name,
    tier: inserted.tier,
    rateLimit: inserted.rateLimit,
    enabled: inserted.enabled,
    lastUsedAt: inserted.lastUsedAt,
    totalRequests: inserted.totalRequests,
    revokedAt: inserted.revokedAt,
    createdAt: inserted.createdAt,
    updatedAt: inserted.updatedAt,
  };

  return { raw, record };
}

// ─── Key lookup ──────────────────────────────────────────────────

interface ApiKeyRecord {
  id: string;
  key: string;
  name: string;
  tier: string;
  rateLimit: number;
  enabled: boolean;
  lastUsedAt: Date | null;
  totalRequests: number;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}

async function findKeyByHash(hash: string): Promise<ApiKeyRecord | null> {
  const results = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.key, hash), isNull(apiKeys.revokedAt), eq(apiKeys.enabled, true)))
    .limit(1);
  return results[0] ?? null;
}

// ─── Rate limiting per key (via Postgres rate_limits table or in-memory) ──

import { createApiKeyLimiter } from "./rate-limit";

// Per-key rate limiters cached by key ID
const keyLimiters = new Map<string, { limit: number; limiter: ReturnType<typeof createApiKeyLimiter> }>();
const dailyLimiters = new Map<string, { limit: number; limiter: ReturnType<typeof createApiKeyLimiter> }>();

const DAILY_QUOTAS = {
  free: 1_000,
  pro: 20_000,
  enterprise: 100_000,
} as const;

function getKeyLimiter(keyId: string, rpm: number) {
  const current = keyLimiters.get(keyId);
  if (!current || current.limit !== rpm) keyLimiters.set(keyId, { limit: rpm, limiter: createApiKeyLimiter(rpm) });
  return keyLimiters.get(keyId)!.limiter;
}

function getDailyLimiter(keyId: string, tier: string) {
  const quota = DAILY_QUOTAS[tier as keyof typeof DAILY_QUOTAS] ?? DAILY_QUOTAS.free;
  const current = dailyLimiters.get(keyId);
  if (!current || current.limit !== quota) dailyLimiters.set(keyId, { limit: quota, limiter: createApiKeyLimiter(quota, 24 * 60 * 60 * 1000) });
  return { limiter: dailyLimiters.get(keyId)!.limiter, quota };
}

// ─── Usage tracking (fire-and-forget) ───────────────────────────

function trackUsage(input: Omit<NewApiKeyUsage, "id" | "createdAt">): void {
  db.insert(apiKeyUsage).values(input).catch((err: unknown) => {
    logger.warn("Failed to track API key usage", { error: err instanceof Error ? err.message : String(err) });
  });
}

// ─── Middleware ──────────────────────────────────────────────────

export interface ApiKeyMiddlewareOptions {
  /** Require a valid API key. If false, allows through with key=null (public endpoints). */
  required?: boolean;
  /** Minimum tier required (optional gate). */
  minTier?: "free" | "pro" | "enterprise";
  /** Endpoint label for usage tracking. */
  endpoint?: string;
}

export interface ApiKeyResult {
  /** The resolved key record (null if not provided). */
  key: ApiKeyRecord | null;
  /** If set, the middleware denied the request — return this response. */
  response: Response | null;
  /** Helper: track usage after the response is built. */
  trackUsage: (statusCode: number, latencyMs: number, req: Request) => void;
  rateLimitHeaders?: Record<string, string>;
}

function extractApiKey(req: Request): string | null {
  // Header first
  const header = req.headers.get("x-api-key");
  if (header) return header;

  // Query param fallback
  try {
    const url = new URL(req.url);
    return url.searchParams.get("apiKey");
  } catch {
    return null;
  }
}

export async function apiKeyMiddleware(
  req: Request,
  options: ApiKeyMiddlewareOptions = {}
): Promise<ApiKeyResult> {
  const { required = false, endpoint = "unknown" } = options;

  const rawKey = extractApiKey(req);

  if (!rawKey) {
    if (required) {
      return {
        key: null,
        response: new Response(
          JSON.stringify({ error: "API key required", detail: "Pass via X-API-Key header or ?apiKey= query parameter" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
        trackUsage: () => {},
      };
    }
    return { key: null, response: null, trackUsage: () => {} };
  }

  const hash = sha256(rawKey);
  let keyRecord: ApiKeyRecord | null;
  try {
    keyRecord = await findKeyByHash(hash);
  } catch (error) {
    logger.error("API key lookup failed", { error: error instanceof Error ? error.message : String(error) });
    return { key: null, response: new Response(JSON.stringify({ error: "authentication_unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "30" } }), trackUsage: () => {} };
  }

  if (!keyRecord) {
    return {
      key: null,
      response: new Response(
        JSON.stringify({ error: "Invalid API key", detail: "The provided key is not valid or has been revoked" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
      trackUsage: () => {},
    };
  }

  // Post-query validation: ensure key is still enabled and not revoked
  if (!keyRecord.enabled || keyRecord.revokedAt) {
    return {
      key: null,
      response: new Response(
        JSON.stringify({ error: "Invalid API key", detail: "The provided key is not valid or has been revoked" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
      trackUsage: () => {},
    };
  }

  // Tier gate
  const tierOrder = { free: 0, pro: 1, enterprise: 2 };
  if (options.minTier && tierOrder[keyRecord.tier as keyof typeof tierOrder] < tierOrder[options.minTier]) {
    return {
      key: keyRecord,
      response: new Response(
        JSON.stringify({ error: "Insufficient tier", detail: `This endpoint requires ${options.minTier} tier or higher` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
      trackUsage: () => {},
    };
  }

  // Per-key requests-per-minute limit (Postgres-backed in production).
  const limiter = getKeyLimiter(keyRecord.id, keyRecord.rateLimit);
  const rateKey = `apikey:${keyRecord.id}`;
  const rateResult = await limiter.check(rateKey);

  if (rateResult.unavailable) {
    return {
      key: keyRecord,
      response: new Response(JSON.stringify({ error: "rate_limit_service_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      }),
      trackUsage: () => {},
    };
  }

  if (!rateResult.allowed) {
    return {
      key: keyRecord,
      response: new Response(JSON.stringify({
        error: "Rate limit exceeded",
        detail: `Key "${keyRecord.name}" (${keyRecord.tier}) exceeded ${keyRecord.rateLimit} requests per minute`,
        retryAfter: rateResult.retryAfter,
        tier: keyRecord.tier,
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateResult.retryAfter ?? 60),
          "X-RateLimit-Limit": String(keyRecord.rateLimit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateResult.resetAfter ?? 60),
        },
      }),
      trackUsage: () => {},
    };
  }

  // Rolling 24-hour quota, separately keyed from the per-minute limiter.
  const daily = getDailyLimiter(keyRecord.id, keyRecord.tier);
  const dailyResult = await daily.limiter.check(`apikey-daily:${keyRecord.id}`);
  if (dailyResult.unavailable) {
    return {
      key: keyRecord,
      response: new Response(JSON.stringify({ error: "quota_service_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      }),
      trackUsage: () => {},
    };
  }

  if (!dailyResult.allowed) {
    return {
      key: keyRecord,
      response: new Response(JSON.stringify({
        error: "Daily quota exceeded",
        quota: daily.quota,
        retryAfter: dailyResult.retryAfter,
        tier: keyRecord.tier,
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(dailyResult.retryAfter ?? 60),
          "X-Quota-Limit": String(daily.quota),
          "X-Quota-Remaining": "0",
          "X-Quota-Reset": String(dailyResult.resetAfter ?? 60),
        },
      }),
      trackUsage: () => {},
    };
  }

  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(keyRecord.rateLimit),
    "X-RateLimit-Remaining": String(rateResult.remaining ?? 0),
    "X-RateLimit-Reset": String(rateResult.resetAfter ?? 60),
    "X-Quota-Limit": String(daily.quota),
    "X-Quota-Remaining": String(dailyResult.remaining ?? 0),
    "X-Quota-Reset": String(dailyResult.resetAfter ?? 86400),
  };

  // Update last used + total requests (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date(), totalRequests: sql`${apiKeys.totalRequests} + 1` })
    .where(eq(apiKeys.id, keyRecord.id))
    .catch(() => {});

  return {
    key: keyRecord,
    response: null,
    rateLimitHeaders,
    trackUsage: (statusCode: number, latencyMs: number, request: Request) => {
      trackUsage({
        keyId: keyRecord.id,
        endpoint,
        method: request.method,
        statusCode,
        latencyMs,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
        userAgent: request.headers.get("user-agent") ?? "unknown",
      });
    },
  };
}
