// src/lib/rate-limit.ts
// In-memory rate limiter using sliding window — works across all API routes.
// Swap to Upstash Redis in production with the same interface.

export interface RateLimiterConfig {
  windowMs: number; // window size in ms
  maxRequests: number; // max requests per window
}

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

  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const existing = windows.get(key);

    // New or expired window
    if (!existing || now > existing.resetAt) {
      windows.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return { allowed: true };
    }

    // Within window
    if (existing.count < this.config.maxRequests) {
      existing.count++;
      return { allowed: true };
    }

    // Rate limited
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
}

// Default: 10 req/min per IP
export const defaultRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

export function rateLimiterMiddleware(limiter: RateLimiter = defaultRateLimiter) {
  return async (request: Request): Promise<Response | null> => {
    // Skip in dev
    if (process.env.NODE_ENV === "development") return null;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const result = limiter.check(ip);
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
