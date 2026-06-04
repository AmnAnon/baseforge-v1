// src/lib/rate-limit.ts
// Rate-limiting abstraction.
// Consolidation phase: Removed Redis dependency in favor of Postgres-backed fixed window.
// In development (CACHE_BACKEND == "memory"): in-memory sliding window per process.
// In production: Postgres-backed fixed window — shared across all serverless instances.

import { db } from "./db/client";
import { rateLimits } from "./db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { resolveCacheBackend } from "./env-config";

export interface RateLimiterConfig {
  windowMs: number; // window size in ms
  maxRequests: number; // max requests per window
}

// ─── In-Memory Sliding Window (Development) ─────────────────────

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (now > entry.resetAt + 60_000) windows.delete(key);
  }
}, 300_000).unref();

export class RateLimiter {
  constructor(private config: RateLimiterConfig) {}

  check(key: string): { allowed: boolean; retryAfter?: number; remaining?: number } {
    const now = Date.now();
    const existing = windows.get(key);

    if (!existing || now > existing.resetAt) {
      windows.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return { allowed: true, remaining: this.config.maxRequests - 1 };
    }

    if (existing.count < this.config.maxRequests) {
      existing.count++;
      return { allowed: true, remaining: this.config.maxRequests - existing.count };
    }

    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  reset(key: string): void { windows.delete(key); }
}

// ─── Postgres Rate Limiter (Production) ─────────────────────────

export class PostgresRateLimiter {
  constructor(private config: RateLimiterConfig) {}

  async check(key: string): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
    const now = new Date();
    try {
      return await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(rateLimits)
          .where(eq(rateLimits.key, key))
          .for("update")
          .limit(1);

        if (existing.length === 0 || now > existing[0].resetAt) {
          const resetAt = new Date(now.getTime() + this.config.windowMs);
          await tx
            .insert(rateLimits)
            .values({ key, count: 1, resetAt })
            .onConflictDoUpdate({
              target: rateLimits.key,
              set: { count: 1, resetAt, updatedAt: now },
            });
          return { allowed: true, remaining: this.config.maxRequests - 1 };
        }

        const entry = existing[0];
        if (entry.count < this.config.maxRequests) {
          await tx
            .update(rateLimits)
            .set({ count: entry.count + 1, updatedAt: now })
            .where(eq(rateLimits.key, key));
          return { allowed: true, remaining: this.config.maxRequests - (entry.count + 1) };
        }

        const retryAfter = Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000);
        return { allowed: false, retryAfter: Math.max(1, retryAfter) };
      });
    } catch (err) {
      logger.error("[PostgresRateLimiter] check failed", { error: String(err) });
      return { allowed: true, remaining: this.config.maxRequests };
    }
  }

  async reset(key: string): Promise<void> {
    try { await db.delete(rateLimits).where(eq(rateLimits.key, key)); } catch {}
  }
}

// ─── Factory ───────────────────────────────────────────

type AnyRateLimiter = RateLimiter | PostgresRateLimiter;

export function createRateLimiter(config: RateLimiterConfig): AnyRateLimiter {
  const backend = resolveCacheBackend();

  if (backend === "memory") {
    return new RateLimiter(config);
  }

  return new PostgresRateLimiter(config);
}

export const defaultRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

export function rateLimiterMiddleware(limiter: AnyRateLimiter = defaultRateLimiter) {
  return async (request: Request): Promise<Response | null> => {
    if (process.env.NODE_ENV !== "production") return null;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const result = await limiter.check(ip);
    if (!result.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfter: result.retryAfter }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfter ?? 60),
          },
        }
      );
    }
    return null;
  };
}

export function createApiKeyLimiter(rpm: number): AnyRateLimiter {
  return createRateLimiter({ windowMs: 60_000, maxRequests: rpm });
}
