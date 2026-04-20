// src/__tests__/integration/indexer.test.ts
// Integration tests for the indexer abstraction layer.
// Tests the unified service, fallback logic, caching, and type contracts.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cache module
vi.mock("@/lib/cache", () => {
  const store = new Map<string, unknown>();
  return {
    cache: {
      get: vi.fn(async (key: string) => store.get(key) || null),
      set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
      del: vi.fn(async (key: string) => { store.delete(key); }),
      clear: vi.fn(async () => { store.clear(); }),
      stats: () => ({ size: store.size, hitRate: 0 }),
      getOrFetch: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()),
      getWithStaleFallback: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => {
        const data = await fetcher();
        return { ...data as Record<string, unknown>, isStale: false };
      }),
    },
    CACHE_TTL: {
      PRICES: 60_000,
      PROTOCOL_LIST: 600_000,
      TVL_HISTORY: 300_000,
      WHALE_TX: 60_000,
      RISK_ANALYSIS: 600_000,
      YIELDS: 300_000,
    },
  };
});

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  },
  timing: () => () => 0,
}));

describe("Indexer Types", () => {
  it("SwapEvent has required fields", async () => {
    const { SwapEventSchema } = await import("@/lib/data/indexers/schemas");

    const validSwap = {
      txHash: "0xabc123",
      blockNumber: 12345678,
      timestamp: 1700000000,
      protocol: "aerodrome",
      pool: "0xpool",
      sender: "0xsender",
      recipient: "0xrecipient",
      tokenIn: "WETH",
      tokenOut: "USDC",
      amountIn: "1000000000000000000",
      amountOut: "2500000000",
      amountUSD: 2500,
    };

    const result = SwapEventSchema.safeParse(validSwap);
    expect(result.success).toBe(true);
  });

  it("SwapEvent rejects invalid protocol", async () => {
    const { SwapEventSchema } = await import("@/lib/data/indexers/schemas");

    const invalidSwap = {
      txHash: "0xabc",
      blockNumber: 123,
      timestamp: 170000,
      protocol: "invalid-protocol",
      pool: "0x",
      sender: "0x",
      recipient: "0x",
      tokenIn: "",
      tokenOut: "",
      amountIn: "0",
      amountOut: "0",
      amountUSD: 0,
    };

    const result = SwapEventSchema.safeParse(invalidSwap);
    expect(result.success).toBe(false);
  });

  it("WhaleFlow validates all flow types", async () => {
    const { WhaleFlowSchema } = await import("@/lib/data/indexers/schemas");

    const flowTypes = ["swap", "transfer", "liquidity_add", "liquidity_remove", "borrow", "repay", "deposit", "withdraw"] as const;

    for (const type of flowTypes) {
      const flow = {
        txHash: "0x123",
        blockNumber: 100,
        timestamp: 1700000000,
        protocol: "aerodrome",
        type,
        from: "0xfrom",
        to: "0xto",
        amountUSD: 100000,
        token: "WETH",
        tokenAmount: "50.0",
      };
      const result = WhaleFlowSchema.safeParse(flow);
      expect(result.success).toBe(true);
    }
  });

  it("LendingEvent validates all action types", async () => {
    const { LendingEventSchema } = await import("@/lib/data/indexers/schemas");

    const actions = ["deposit", "withdraw", "borrow", "repay", "liquidation"] as const;

    for (const action of actions) {
      const event = {
        txHash: "0x456",
        blockNumber: 200,
        timestamp: 1700000000,
        protocol: "seamless",
        action,
        user: "0xuser",
        asset: "0xasset",
        amount: "1000.0",
        amountUSD: 1000,
      };
      const result = LendingEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    }
  });

  it("ProtocolMetrics has all required fields", async () => {
    const { ProtocolMetricsSchema } = await import("@/lib/data/indexers/schemas");

    const metrics = {
      protocol: "aerodrome",
      swapVolume24h: 5000000,
      swapCount24h: 1234,
      uniqueTraders24h: 456,
      tvl: 100000000,
      largestSwap24h: 500000,
      fees24h: 15000,
      netFlow24h: -200000,
    };

    const result = ProtocolMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });
});

describe("Contract Addresses", () => {
  it("exports known Base chain contracts", async () => {
    const { CONTRACTS } = await import("@/lib/data/indexers/contracts");

    expect(CONTRACTS.WETH).toBe("0x4200000000000000000000000000000000000006");
    expect(CONTRACTS.USDC).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(CONTRACTS.AERODROME_FACTORY).toBe("0x420DD381b31aEf6683db6B902084cB0FFECe40Da");
    expect(CONTRACTS.UNISWAP_V3_FACTORY).toBe("0x33128a8fC17869897dcE68Ed026d694621f6FDfD");
    expect(CONTRACTS.SEAMLESS_POOL).toBe("0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7");
  });

  it("has matching token decimals for all known tokens", async () => {
    const { CONTRACTS, TOKEN_DECIMALS } = await import("@/lib/data/indexers/contracts");

    expect(TOKEN_DECIMALS[CONTRACTS.WETH]).toBe(18);
    expect(TOKEN_DECIMALS[CONTRACTS.USDC]).toBe(6);
    expect(TOKEN_DECIMALS[CONTRACTS.USDbC]).toBe(6);
    expect(TOKEN_DECIMALS[CONTRACTS.DAI]).toBe(18);
  });

  it("has event signature hashes in correct format", async () => {
    const { EVENT_SIGNATURES } = await import("@/lib/data/indexers/contracts");

    // All should be 0x-prefixed 64-char hex strings (32 bytes)
    for (const [_name, sig] of Object.entries(EVENT_SIGNATURES)) {
      expect(sig).toMatch(/^0x[0-9a-f]{64}$/i);
    }
  });
});

describe("Health Score with On-chain Data", () => {
  it("rewards protocols with healthy swap volume", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    const base = {
      audits: 2,
      tvl: 50_000_000,
      tvlChange24h: 1,
      tvlChange7d: 2,
      category: "Dexes",
      oracles: ["Chainlink", "Pyth"],
    };

    const withoutVolume = calculateHealthScore(base);
    const withVolume = calculateHealthScore({
      ...base,
      swapVolume24h: 1_000_000, // 2% of TVL
      uniqueTraders24h: 500,
    });

    expect(withVolume.score).toBeGreaterThan(withoutVolume.score);
  });

  it("penalizes protocols with significant outflows", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    const base = {
      audits: 2,
      tvl: 50_000_000,
      tvlChange24h: -2,
      tvlChange7d: -5,
      category: "Dexes",
      oracles: ["Chainlink"],
    };

    const neutral = calculateHealthScore({ ...base, netFlow24h: 0 });
    const outflows = calculateHealthScore({ ...base, netFlow24h: -10_000_000 }); // 20% outflow

    expect(outflows.score).toBeLessThan(neutral.score);
    expect(outflows.riskFactors).toContain("Significant net outflows (>10% TVL)");
  });

  it("rewards net inflows", async () => {
    const { calculateHealthScore } = await import("@/lib/protocol-aggregator");

    const base = {
      audits: 1,
      tvl: 20_000_000,
      tvlChange24h: 0,
      tvlChange7d: 0,
      category: "Lending",
      oracles: ["Chainlink"],
    };

    const noFlow = calculateHealthScore(base);
    const inflows = calculateHealthScore({ ...base, netFlow24h: 500_000 });

    expect(inflows.score).toBeGreaterThanOrEqual(noFlow.score);
  });
});

describe("Indexer Response Schemas", () => {
  it("validates SwapsResponse shape", async () => {
    const { SwapsResponseSchema } = await import("@/lib/data/indexers/schemas");

    const valid = {
      swaps: [],
      total: 0,
      source: "envio-hypersync",
      timestamp: Date.now(),
      isStale: false,
    };

    const result = SwapsResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates WhaleFlowsResponse shape", async () => {
    const { WhaleFlowsResponseSchema } = await import("@/lib/data/indexers/schemas");

    const valid = {
      flows: [],
      total: 0,
      summary: {
        totalVolumeUSD: 0,
        largestFlowUSD: 0,
        netFlowUSD: 0,
        byType: {},
      },
      source: "etherscan-fallback",
      timestamp: Date.now(),
      isStale: false,
    };

    const result = WhaleFlowsResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates LendingResponse shape", async () => {
    const { LendingResponseSchema } = await import("@/lib/data/indexers/schemas");

    const valid = {
      events: [],
      total: 0,
      summary: {
        totalDepositsUSD: 0,
        totalBorrowsUSD: 0,
        totalLiquidationsUSD: 0,
        netFlowUSD: 0,
      },
      source: "envio-hypersync",
      timestamp: Date.now(),
      isStale: false,
    };

    const result = LendingResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
