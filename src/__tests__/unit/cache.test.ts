// src/__tests__/unit/cache.test.ts
// Tests for the cache abstraction: memory driver, getOrFetch, stale fallback.

import { describe, it, expect, vi } from "vitest";

describe("Memory Cache Backend", () => {
  it("stores and retrieves values", async () => {
    const { cache } = await import("@/lib/cache");
    await cache.set("test-key", { hello: "world" }, 60);
    const result = await cache.get<{ hello: string }>("test-key");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null for missing keys", async () => {
    const { cache } = await import("@/lib/cache");
    const result = await cache.get("nonexistent-key-unique");
    expect(result).toBeNull();
  });

  it("expires values after TTL", async () => {
    vi.useFakeTimers();
    const { cache } = await import("@/lib/cache");

    await cache.set("expiring-key", "value", 1); // 1 second TTL
    const before = await cache.get("expiring-key");
    expect(before).toBe("value");

    vi.advanceTimersByTime(2000); // 2 seconds later

    const after = await cache.get("expiring-key");
    expect(after).toBeNull();

    vi.useRealTimers();
  });

  it("deletes keys", async () => {
    const { cache } = await import("@/lib/cache");
    await cache.set("delete-me", "value", 60);
    await cache.del("delete-me");
    const result = await cache.get("delete-me");
    expect(result).toBeNull();
  });

  it("tracks hit rate", async () => {
    const { cache } = await import("@/lib/cache");
    // Clear to get clean baseline
    await cache.clear();

    const uniqueKey = `hit-test-${Date.now()}-${Math.random()}`;
    await cache.set(uniqueKey, 42, 60);
    await cache.get(uniqueKey); // hit
    await cache.get(uniqueKey); // hit
    await cache.get(uniqueKey); // hit
    await cache.get(`miss-${Date.now()}`); // miss

    const stats = cache.stats();
    expect(stats.hitRate).toBeGreaterThanOrEqual(0.75);
  });

  it("clears all entries", async () => {
    const { cache } = await import("@/lib/cache");
    await cache.set("a", 1, 60);
    await cache.set("b", 2, 60);
    await cache.clear();

    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("b")).toBeNull();
  });
});

describe("cache.getOrFetch", () => {
  it("fetches and caches on miss", async () => {
    const { cache } = await import("@/lib/cache");
    const fetcher = vi.fn().mockResolvedValue({ fresh: true });

    const result = await cache.getOrFetch("or-fresh-key-unique", 60_000, fetcher);
    expect(result).toEqual({ fresh: true });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const cached = await cache.getOrFetch("or-fresh-key-unique", 60_000, fetcher);
    expect(cached).toEqual({ fresh: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("propagates fetcher errors", async () => {
    const { cache } = await import("@/lib/cache");
    const fetcher = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(cache.getOrFetch("fail-key-unique", 60_000, fetcher)).rejects.toThrow("network error");
  });
});

describe("cache.getWithStaleFallback", () => {
  it("returns fresh data when fetcher succeeds", async () => {
    const { cache } = await import("@/lib/cache");
    const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });

    const result = await cache.getWithStaleFallback<{ data: string; isStale: boolean }>(
      "stale-ok-unique",
      60_000,
      fetcher
    );
    expect(result.isStale).toBe(false);
    expect(result.data).toBe("fresh");
  });
});

describe("cache.getStale", () => {
  it("returns expired entries", async () => {
    const { cache } = await import("@/lib/cache");

    await cache.set("stale-entry-unique", { data: "old" }, 1);
    const stale = await cache.getStale<{ data: string }>("stale-entry-unique");
    expect(stale?.data).toBe("old");
  });
});
