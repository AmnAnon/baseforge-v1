// src/__tests__/integration/indexer-layer.test.ts
// Tests the unified indexer service (orchestration + cache + fallback).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
}));

vi.mock("@/lib/monitoring", () => ({
  monitor: {
    trackDataSourceFailure: vi.fn(),
    trackDataSourceRecovery: vi.fn(),
    trackLatency: vi.fn(),
    trackProviderSwitch: vi.fn(),
  },
}));

describe("Indexer Service Orchestration", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ENVIO_API_TOKEN = "test-token";
  });

  it("getLargeSwaps returns cached data when available", async () => {
    const { cache } = await import("@/lib/cache");
    const cachedSwaps = {
      swaps: [{ txHash: "0xcached", blockNumber: 19999999, timestamp: Date.now(), protocol: "aerodrome" as const, amountUSD: 50000, pool: "0x", sender: "0x", recipient: "0x", tokenIn: "WETH", tokenOut: "USDC", amountIn: "10", amountOut: "32000" }],
      source: "envio-hypersync",
      timestamp: Date.now(),
    };
    await cache.set("idx:swaps:aerodrome:0", cachedSwaps, 60);

    const { getLargeSwaps } = await import("@/lib/data/indexers");
    const result = await getLargeSwaps({ protocol: "aerodrome", minAmountUSD: 0 });

    expect(result.swaps.length).toBe(1);
    expect(result.swaps[0].txHash).toBe("0xcached");
    expect(result.source).toBe("envio-hypersync");
  });

  it("getIndexerHealth returns primary and fallback status", async () => {
    const { getIndexerHealth } = await import("@/lib/data/indexers");
    const health = await getIndexerHealth();

    expect(health).toHaveProperty("primary");
    expect(health).toHaveProperty("fallback");
    expect(health).toHaveProperty("activeProvider");
    expect(health.primary).toHaveProperty("provider");
    expect(health.primary).toHaveProperty("healthy");
    expect(health.fallback).toHaveProperty("provider");
    expect(health.fallback).toHaveProperty("healthy");
  });
});

describe("Indexer Response Schemas", () => {
  it("validates SwapEvent shape", async () => {
    const { SwapEventSchema } = await import("@/lib/data/indexers/schemas");
    const valid = {
      txHash: "0xabc", blockNumber: 1, timestamp: 123, protocol: "aerodrome" as const,
      pool: "0x", sender: "0x", recipient: "0x", tokenIn: "A", tokenOut: "B",
      amountIn: "1", amountOut: "2", amountUSD: 100,
    };
    expect(SwapEventSchema.safeParse(valid).success).toBe(true);

    const invalid = { ...valid, amountUSD: "not-a-number" };
    expect(SwapEventSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates WhaleFlow shape", async () => {
    const { WhaleFlowSchema } = await import("@/lib/data/indexers/schemas");
    const valid = {
      txHash: "0xabc", blockNumber: 1, timestamp: 123, protocol: "uniswap",
      type: "swap" as const, from: "0x", to: "0x", amountUSD: 100,
      token: "WETH", tokenAmount: "1.0",
    };
    expect(WhaleFlowSchema.safeParse(valid).success).toBe(true);
  });

  it("validates LendingEvent shape", async () => {
    const { LendingEventSchema } = await import("@/lib/data/indexers/schemas");
    const valid = {
      txHash: "0xabc", blockNumber: 1, timestamp: 123, protocol: "seamless" as const,
      action: "deposit" as const, user: "0x", asset: "0x", amount: "100", amountUSD: 100,
    };
    expect(LendingEventSchema.safeParse(valid).success).toBe(true);
  });

  it("validates SwapsResponse shape", async () => {
    const { SwapsResponseSchema } = await import("@/lib/data/indexers/schemas");
    const valid = {
      swaps: [], total: 0, source: "envio", timestamp: Date.now(), isStale: false,
    };
    expect(SwapsResponseSchema.safeParse(valid).success).toBe(true);
  });
});

describe("Contracts Registry", () => {
  it("has valid Base chain addresses", async () => {
    const { CONTRACTS } = await import("@/lib/data/indexers/contracts");
    expect(CONTRACTS.WETH).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(CONTRACTS.USDC).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(CONTRACTS.AERODROME_ROUTER).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(CONTRACTS.UNISWAP_V3_ROUTER).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(CONTRACTS.SEAMLESS_POOL).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("has valid event signatures", async () => {
    const { EVENT_SIGNATURES } = await import("@/lib/data/indexers/contracts");
    for (const [_name, sig] of Object.entries(EVENT_SIGNATURES)) {
      expect(sig).toMatch(/^0x[a-fA-F0-9]{64}$/);
    }
  });

  it("has token decimals for all known tokens", async () => {
    const { CONTRACTS, TOKEN_DECIMALS } = await import("@/lib/data/indexers/contracts");
    for (const token of [CONTRACTS.WETH, CONTRACTS.USDC, CONTRACTS.USDbC, CONTRACTS.DAI, CONTRACTS.cbETH, CONTRACTS.AERO]) {
      expect(TOKEN_DECIMALS[token]).toBeDefined();
    }
  });
});
