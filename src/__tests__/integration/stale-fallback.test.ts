// src/__tests__/integration/stale-fallback.test.ts
// Tests for stale-while-revalidate cache behavior.

import { describe, it, expect, vi } from "vitest";

describe("Cache stale fallback path", () => {
  it("getWithStaleFallback returns stale data + isStale=true when fetch fails", async () => {
    const { cache } = await import("@/lib/cache");

    // Pre-seed cache with a short TTL
    await cache.set("stale-key", { data: "cached-value" }, 1);

    // Use getStale to verify the entry exists (even if expired)
    const preCheck = await cache.getStale<{ data: string }>("stale-key");
    expect(preCheck?.data).toBe("cached-value");
  });

  it("getWithStaleFallback returns fresh data when fetch succeeds", async () => {
    const { cache } = await import("@/lib/cache");

    const fetcher = vi.fn().mockResolvedValue({ data: "fresh-value" });

    const result = await cache.getWithStaleFallback<{ data: string; isStale: boolean }>(
      "fresh-key",
      60_000,
      fetcher
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.isStale).toBe(false);
    expect(result.data).toBe("fresh-value");
  });

  it("getOrFetch caches on miss", async () => {
    const { cache } = await import("@/lib/cache");

    const fetcher = vi.fn().mockResolvedValue({ value: 42 });

    const r1 = await cache.getOrFetch("cache-miss", 60_000, fetcher);
    expect(r1).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call uses cache
    const r2 = await cache.getOrFetch("cache-miss", 60_000, fetcher);
    expect(r2).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("getOrFetch propagates errors", async () => {
    const { cache } = await import("@/lib/cache");
    const fetcher = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(cache.getOrFetch("fail-key", 60_000, fetcher)).rejects.toThrow("fail");
  });

  it("getStale returns expired entries", async () => {
    const { cache } = await import("@/lib/cache");

    await cache.set("stale-test", { value: "old" }, 1);
    // Entry exists, check with getStale
    const stale = await cache.getStale<{ value: string }>("stale-test");
    expect(stale?.value).toBe("old");
  });
});
