// src/lib/rate-limit.ts
// Rate-limiting abstraction.
//
// In development (CACHE_BACKEND != "upstash"): in-memory sliding window per process.
// In production with Upstash configured: Redis-backed fixed window — limits are shared
// across all serverless instances so they can't be bypassed by hitting different replicas.
//
// Both implementations expose the same interface so callers don't change.

import { Redis } from "@upstash/redis";

export interface RateLimiterConfig {
  windowMs: number; // window size in ms
  maxRequests: number; // max requests per window
}

// ─── In-Memory Sliding Window ────────────────────────────────────

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

    // New or expired window
    if (!existing || now > existing.resetAt) {
      windows.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return { allowed: true, remaining: this.config.maxRequests - 1 };
    }

    // Within window
    if (existing.count < this.config.maxRequests) {
      existing.count++;
      return { allowed: true, remaining: this.config.maxRequests - existing.count };
    }

    // Rate limited
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  /** Reset limit for a specific key (e.g., after tier upgrade). */
  reset(key: string): void {
    windows.delete(key);
  }
}

// ─── Redis Fixed-Window Rate Limiter (production) ────────────────
// Uses INCR + EXPIRE so limits are shared across all replicas.
// Key pattern: rl:{identifier}:{windowFloorSeconds}

let _redis: Redis | null = null;
function getRedisClient(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

export class RedisRateLimiter {
  constructor(private config: RateLimiterConfig) {}

  async check(key: string): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
    const redis = getRedisClient();
    if (!redis) {
      // Redis not configured — fall back to in-memory limiter silently
      return new RateLimiter(this.config).check(key);
    }

    const windowSec = Math.ceil(this.config.windowMs / 1000);
    const windowFloor = Math.floor(Date.now() / this.config.windowMs);
    const redisKey = `rl:${key}:${windowFloor}`;

    try {
      // Pipeline: INCR and EXPIRE NX (set expiry only if not already set) in one round-trip.
      // Using NX prevents resetting the TTL on every request under high traffic, which
      // would cause the window to never expire.
      const pipeline = redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, windowSec + 1, "NX"); // +1 so keys outlive the window slightly
      const [countRaw] = (await pipeline.exec()) as [number, number];
      const count = Number(countRaw);

      if (count > this.config.maxRequests) {
        const windowResetMs = (windowFloor + 1) * this.config.windowMs;
        const retryAfter = Math.ceil((windowResetMs - Date.now()) / 1000);
        return { allowed: false, retryAfter: Math.max(1, retryAfter) };
      }

      return { allowed: true, remaining: this.config.maxRequests - count };
    } catch {
      // Redis error — fail open to avoid blocking legitimate traffic
      return { allowed: true, remaining: this.config.maxRequests };
    }
  }

  reset(): void {
    // Redis keys expire naturally; explicit reset would need DEL but is rarely needed
  }
}

// ─── Factory: pick the right implementation at runtime ────────────

/**
 * Create a rate limiter appropriate for the current environment.
 * - Production with Upstash: returns a RedisRateLimiter (distributed, replica-safe).
 * - Development / no Redis: returns an in-process RateLimiter.
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter | RedisRateLimiter {
  const useRedis =
    process.env.CACHE_BACKEND === "upstash" &&
    process.env.UPSTASH_REDIS_URL &&
    process.env.UPSTASH_REDIS_TOKEN;
  return useRedis ? new RedisRateLimiter(config) : new RateLimiter(config);
}

// Default: 10 req/min per IP
export const defaultRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

export function rateLimiterMiddleware(limiter: RateLimiter | RedisRateLimiter = defaultRateLimiter) {
  return async (request: Request): Promise<Response | null> => {
    // Skip rate limiting outside production
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

/** Create a per-API-key rate limiter with custom limits. */
export function createApiKeyLimiter(rpm: number): RateLimiter | RedisRateLimiter {
  return createRateLimiter({ windowMs: 60_000, maxRequests: rpm });
}
