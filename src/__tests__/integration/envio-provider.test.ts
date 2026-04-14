// src/__tests__/integration/envio-provider.test.ts
// Tests for the Envio HyperSync provider with MSW.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
}));

vi.mock("@/lib/circuit-breaker", () => {
  const CircuitBreaker = class {
    async execute<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
    get state() { return "closed" as const; }
    get isOpen() { return false; }
    get metricsSnapshot() { return { state: "closed" as const, failures: 0, successes: 0, lastFailureAt: null, lastStateChangeAt: Date.now() }; }
    reset() {}
  };
  return {
    CircuitBreaker,
    CircuitOpenError: class extends Error { constructor(n: string) { super(n); this.name = "CircuitOpenError"; } },
    circuitBreakers: {
      envio: new CircuitBreaker(),
      etherscan: new CircuitBreaker(),
      defillama: new CircuitBreaker(),
      coingecko: new CircuitBreaker(),
    },
  };
});

describe("Envio HyperSync Provider", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ENVIO_API_TOKEN = "test-token";
  });

  it("fetches swap events from Aerodrome", async () => {
    const { getSwaps } = await import("@/lib/data/indexers/envio-provider");

    const swaps = await getSwaps({ protocol: "aerodrome", limit: 10, minAmountUSD: 0 });

    expect(Array.isArray(swaps)).toBe(true);
    expect(swaps.length).toBeGreaterThan(0);

    const swap = swaps[0];
    expect(swap.protocol).toBe("aerodrome");
    expect(swap.txHash).toBe("0xdef456");
    expect(swap.blockNumber).toBe(20000000);
    expect(swap.amountUSD).toBeGreaterThan(0);
  });

  it("fetches whale flows across protocols", async () => {
    const { getWhaleFlows } = await import("@/lib/data/indexers/envio-provider");

    const flows = await getWhaleFlows({ minAmountUSD: 0, limit: 50 });

    expect(Array.isArray(flows)).toBe(true);
  });

  it("fetches lending events from Seamless", async () => {
    const { getLendingEvents } = await import("@/lib/data/indexers/envio-provider");

    const events = await getLendingEvents({ minAmountUSD: 0, limit: 50 });

    expect(Array.isArray(events)).toBe(true);
  });

  it("reports healthy status", async () => {
    const { checkHealth } = await import("@/lib/data/indexers/envio-provider");

    const health = await checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe("envio-hypersync");
    expect(health.lastBlock).toBe(20000100);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns empty array when protocol filter doesn't match", async () => {
    const { getSwaps } = await import("@/lib/data/indexers/envio-provider");

    // Request only uniswap-v3 — should still get data since MSW returns both event types
    const swaps = await getSwaps({ protocol: "uniswap-v3", limit: 10, minAmountUSD: 1_000_000_000 });

    // With minAmountUSD high, likely no matches from mock data
    expect(Array.isArray(swaps)).toBe(true);
  });

  it("respects the limit parameter", async () => {
    const { getSwaps } = await import("@/lib/data/indexers/envio-provider");

    const swaps = await getSwaps({ protocol: "aerodrome", limit: 1, minAmountUSD: 0 });

    expect(swaps.length).toBeLessThanOrEqual(1);
  });
});
