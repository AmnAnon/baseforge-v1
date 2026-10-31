import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("returns remaining capacity and reset windows", () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const key = `rate-limit-test-${Date.now()}`;

    const first = limiter.check(key);
    const second = limiter.check(key);
    const third = limiter.check(key);

    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    expect(first.resetAfter).toBeGreaterThan(0);
    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it("supports a rolling daily quota window", () => {
    const limiter = new RateLimiter({ windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 });
    const key = `daily-quota-test-${Date.now()}`;

    expect(limiter.check(key).allowed).toBe(true);
    expect(limiter.check(key).allowed).toBe(false);
  });
});
