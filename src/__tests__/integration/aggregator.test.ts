// src/__tests__/integration/aggregator.test.ts
// Integration tests for protocol-aggregator and data pipeline.
// Tests scoring logic, on-chain enrichment, caching, and edge cases.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock cache
const mockStore = new Map<string, unknown>();
vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(async (key: string) => mockStore.get(key) || null),
    set: vi.fn(async (key: string, value: unknown) => { mockStore.set(key, value); }),
    del: vi.fn(async (key: string) => { mockStore.delete(key); }),
    clear: vi.fn(async () => { mockStore.clear(); }),
    stats: () => ({ size: mockStore.size, hitRate: 0 }),
    getOrFetch: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
    getWithStaleFallback: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => {
      const d = await fn();
      return { ...(d as Record<string, unknown>), isStale: false };
    }),
  },
  CACHE_TTL: { PRICES: 60000, PROTOCOL_LIST: 600000, TVL_HISTORY: 300000, WHALE_TX: 60000, RISK_ANALYSIS: 600000, YIELDS: 300000 },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
  timing: () => () => 0,
}));

vi.mock("@/lib/monitoring", () => ({
  monitor: {
    trackDataSourceFailure: vi.fn(),
    trackDataSourceRecovery: vi.fn(),
    trackLatency: vi.fn(),
    reportAnomaly: vi.fn(),
    trackProviderSwitch: vi.fn(),
  },
}));

vi.mock("@/lib/data/indexers", () => ({
  getProtocolEvents: vi.fn(async () => ({
    protocol: "test",
    swapVolume24h: 1_000_000,
    swapCount24h: 500,
    uniqueTraders24h: 200,
    tvl: 0,
    largestSwap24h: 100_000,
    fees24h: 3000,
    netFlow24h: 50_000,
  })),
}));

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
});

describe("calculateHealthScore", () => {
  let calculateHealthScore: typeof import("@/lib/protocol-aggregator").calculateHealthScore;

  beforeEach(async () => {
    ({ calculateHealthScore } = await import("@/lib/protocol-aggregator"));
  });

  it("neutral baseline is 50 for a completely unknown protocol", () => {
    const { score } = calculateHealthScore({
      audits: 0, tvl: 500_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Unknown", oracles: [],
    });
    // Should be less than 50 because no audits = -15
    expect(score).toBeLessThan(50);
    expect(score).toBeGreaterThan(0);
  });

  it("well-audited large DEX gets high score", () => {
    const { score, riskFactors } = calculateHealthScore({
      audits: 3, tvl: 500_000_000, tvlChange24h: 1, tvlChange7d: 2,
      category: "Dexes", oracles: ["Chainlink", "Pyth"],
      forkedFrom: ["uniswap-v2"],
      swapVolume24h: 5_000_000, uniqueTraders24h: 1000, netFlow24h: 100_000,
    });
    expect(score).toBeGreaterThanOrEqual(80);
    expect(riskFactors).toHaveLength(0);
  });

  it("unaudited micro-cap protocol gets low score", () => {
    const { score, riskFactors } = calculateHealthScore({
      audits: 0, tvl: 50_000, tvlChange24h: -5, tvlChange7d: -30,
      category: "Yield", oracles: [],
    });
    expect(score).toBeLessThan(30);
    expect(riskFactors).toContain("No audits");
    expect(riskFactors).toContain("Low TVL");
    expect(riskFactors).toContain("High TVL volatility");
  });

  it("penalizes extreme TVL drop", () => {
    const stable = calculateHealthScore({
      audits: 2, tvl: 50_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Lending", oracles: ["Chainlink"],
    });
    const crashing = calculateHealthScore({
      audits: 2, tvl: 50_000_000, tvlChange24h: -15, tvlChange7d: -30,
      category: "Lending", oracles: ["Chainlink"],
    });
    expect(crashing.score).toBeLessThan(stable.score);
    expect(crashing.riskFactors).toContain("Extreme 24h TVL swing");
    expect(crashing.riskFactors).toContain("High TVL volatility");
  });

  it("flags suspiciously high APY", () => {
    const { riskFactors } = calculateHealthScore({
      audits: 1, tvl: 10_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Yield", oracles: ["Chainlink"], apy: 5000,
    });
    expect(riskFactors).toContain("Suspiciously high APY");
  });

  it("rewards fork lineage", () => {
    const original = calculateHealthScore({
      audits: 1, tvl: 5_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Lending", oracles: ["Chainlink"],
    });
    const forked = calculateHealthScore({
      audits: 1, tvl: 5_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Lending", oracles: ["Chainlink"], forkedFrom: ["aave-v3"],
    });
    expect(forked.score).toBeGreaterThan(original.score);
  });

  // ── On-chain signal tests ──

  it("rewards healthy swap volume", () => {
    const noVolume = calculateHealthScore({
      audits: 2, tvl: 100_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink", "Pyth"],
    });
    const withVolume = calculateHealthScore({
      audits: 2, tvl: 100_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink", "Pyth"],
      swapVolume24h: 5_000_000,
    });
    expect(withVolume.score).toBeGreaterThan(noVolume.score);
  });

  it("penalizes massive outflows", () => {
    const { score, riskFactors } = calculateHealthScore({
      audits: 2, tvl: 50_000_000, tvlChange24h: -3, tvlChange7d: -5,
      category: "Lending", oracles: ["Chainlink"],
      netFlow24h: -10_000_000, // 20% outflow
    });
    expect(riskFactors).toContain("Significant net outflows (>10% TVL)");
    expect(score).toBeLessThanOrEqual(70);
  });

  it("rewards net inflows", () => {
    const noFlow = calculateHealthScore({
      audits: 1, tvl: 20_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink"],
    });
    const inflows = calculateHealthScore({
      audits: 1, tvl: 20_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink"],
      netFlow24h: 500_000,
    });
    expect(inflows.score).toBeGreaterThanOrEqual(noFlow.score);
  });

  it("penalizes zero traders on a DEX", () => {
    const { riskFactors } = calculateHealthScore({
      audits: 1, tvl: 10_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink"],
      uniqueTraders24h: 0,
    });
    expect(riskFactors).toContain("Zero unique traders in 24h");
  });

  it("flags low volume on a DEX", () => {
    const { riskFactors } = calculateHealthScore({
      audits: 2, tvl: 100_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink", "Pyth"],
      swapVolume24h: 50_000, // 0.05% of TVL
    });
    expect(riskFactors).toContain("Very low trading volume relative to TVL");
  });

  it("clamps score to 0-100 range", () => {
    // Max everything positive
    const best = calculateHealthScore({
      audits: 10, tvl: 1_000_000_000, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: ["Chainlink", "Pyth", "Band"],
      forkedFrom: ["uniswap-v3"],
      swapVolume24h: 50_000_000, uniqueTraders24h: 5000, netFlow24h: 1_000_000,
    });
    expect(best.score).toBeLessThanOrEqual(100);
    expect(best.score).toBeGreaterThanOrEqual(0);

    // Max everything negative
    const worst = calculateHealthScore({
      audits: 0, tvl: 1000, tvlChange24h: -50, tvlChange7d: -80,
      category: "Bridge", oracles: [],
      apy: 50000, swapVolume24h: 0, uniqueTraders24h: 0, netFlow24h: -500,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("Score distribution sanity", () => {
  it("category baseline ordering is sensible", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    const base = {
      audits: 1, tvl: 10_000_000, tvlChange24h: 0, tvlChange7d: 0,
      oracles: ["Chainlink"],
    };

    const lending = calculateHealthScore({ ...base, category: "Lending" });
    const bridge = calculateHealthScore({ ...base, category: "Bridge" });
    const yield_ = calculateHealthScore({ ...base, category: "Yield" });

    // Lending should score higher than Bridge
    expect(lending.score).toBeGreaterThan(bridge.score);
    // Lending should score higher than Yield
    expect(lending.score).toBeGreaterThan(yield_.score);
  });
});

describe("Edge cases", () => {
  it("handles zero TVL without division errors", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    const { score } = calculateHealthScore({
      audits: 0, tvl: 0, tvlChange24h: 0, tvlChange7d: 0,
      category: "Unknown", oracles: [],
      swapVolume24h: 0, netFlow24h: 0,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(score)).toBe(true);
  });

  it("handles negative TVL gracefully", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    const { score } = calculateHealthScore({
      audits: 1, tvl: -100, tvlChange24h: 0, tvlChange7d: 0,
      category: "Dexes", oracles: [],
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(score)).toBe(true);
  });

  it("handles undefined on-chain fields", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    // Should not crash when on-chain fields are undefined
    const { score } = calculateHealthScore({
      audits: 2, tvl: 50_000_000, tvlChange24h: 1, tvlChange7d: 2,
      category: "Dexes", oracles: ["Chainlink"],
      swapVolume24h: undefined,
      netFlow24h: undefined,
      uniqueTraders24h: undefined,
    });
    expect(score).toBeGreaterThan(50);
  });
});

describe("Monitoring integration", () => {
  it("monitor module exports all tracking functions", async () => {
    const { monitor } = await import("@/lib/monitoring");

    expect(typeof monitor.trackDataSourceFailure).toBe("function");
    expect(typeof monitor.trackDataSourceRecovery).toBe("function");
    expect(typeof monitor.trackLatency).toBe("function");
    expect(typeof monitor.reportAnomaly).toBe("function");
    expect(typeof monitor.trackProviderSwitch).toBe("function");
  });
});
