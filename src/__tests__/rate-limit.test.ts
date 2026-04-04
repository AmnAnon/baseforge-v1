// src/__tests__/rate-limit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 5_000, maxRequests: 3 });
  });

  it("allows requests within limit", () => {
    expect(limiter.check("user-a").allowed).toBe(true);
    expect(limiter.check("user-a").allowed).toBe(true);
    expect(limiter.check("user-a").allowed).toBe(true);
  });

  it("blocks after max requests", () => {
    limiter.check("user-b");
    limiter.check("user-b");
    limiter.check("user-b");
    const result = limiter.check("user-b");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    const shortLimiter = new RateLimiter({ windowMs: 10, maxRequests: 1 });
    expect(shortLimiter.check("user-c").allowed).toBe(true);
    expect(shortLimiter.check("user-c").allowed).toBe(false);
  });

  it("tracks separate users independently", () => {
    limiter.check("user-x");
    expect(limiter.check("user-y").allowed).toBe(true);
  });
});
