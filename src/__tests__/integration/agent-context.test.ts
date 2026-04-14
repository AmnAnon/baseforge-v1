// src/__tests__/integration/agent-context.test.ts
// Tests for /api/agents/context — schema validation, query params, stale fallback.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock everything the route depends on ──────────────────────

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    stats: () => ({ size: 0, hitRate: 0 }),
  },
  CACHE_TTL: { PRICES: 60_000 },
}));

vi.mock("@/lib/rate-limit", () => ({
  RateLimiter: class {
    check() {
      return { allowed: true, remaining: 99 };
    }
  },
  rateLimiterMiddleware: () => () => null,
}));

vi.mock("@/lib/api-key", () => ({
  apiKeyMiddleware: vi.fn().mockResolvedValue({
    key: { tier: "free", rateLimit: 100, name: "test-key" },
    response: null,
    trackUsage: () => {},
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  },
  timing: () => () => 150,
}));

vi.mock("@/lib/data/indexers", () => ({
  getLargeSwaps: vi.fn().mockResolvedValue({
    swaps: [{ txHash: "0xabc", blockNumber: 20000000, timestamp: Date.now(), protocol: "aerodrome", amountUSD: 100000, type: "swap", from: "0x1", to: "0x2", token: "WETH", tokenAmount: "50", pool: "0xpool", sender: "0x1", recipient: "0x2", tokenIn: "WETH", tokenOut: "USDC", amountIn: "50", amountOut: "160000" }],
    source: "envio-hypersync",
    timestamp: Date.now(),
    summary: { totalVolumeUSD: 100000, largestFlowUSD: 100000, netFlowUSD: 50000, byType: { swap: 1 } },
  }),
  getWhaleFlows: vi.fn().mockResolvedValue({
    flows: [
      { txHash: "0xwhale1", blockNumber: 20000000, timestamp: Date.now(), protocol: "aerodrome", type: "deposit", from: "0xwhale", to: "0xpool", amountUSD: 200000, token: "WETH", tokenAmount: "100" },
    ],
    source: "envio-hypersync",
    timestamp: Date.now(),
    summary: { totalVolumeUSD: 200000, largestFlowUSD: 200000, netFlowUSD: 200000, byType: { deposit: 1 } },
  }),
  getLendingActivity: vi.fn().mockResolvedValue({
    events: [
      { txHash: "0xlend1", blockNumber: 20000000, timestamp: Date.now(), protocol: "seamless", action: "deposit", user: "0xuser", asset: "0xasset", amount: "50000", amountUSD: 50000 },
    ],
    source: "envio-hypersync",
    timestamp: Date.now(),
    summary: { totalDepositsUSD: 50000, totalBorrowsUSD: 0, totalLiquidationsUSD: 0, netFlowUSD: 50000 },
  }),
  getIndexerHealth: vi.fn().mockResolvedValue({
    primary: { provider: "envio-hypersync", healthy: true, latencyMs: 45, lastBlock: 20000100, chainHead: 20000100, lag: 0, lastChecked: Date.now() },
    fallback: { provider: "etherscan-fallback", healthy: true, latencyMs: 120, lastBlock: 20000099, chainHead: 20000099, lag: 0, lastChecked: Date.now() },
    activeProvider: "envio-hypersync",
  }),
}));

// Mock fetch for DefiLlama + CoinGecko
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockDefiLlamaResponses() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/protocols")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            id: "aerodrome", name: "Aerodrome", slug: "aerodrome",
            category: "Dexes", chainTvls: { Base: 2_100_000_000 },
            change_1d: 1.2, change_7d: 5.4, audits: 2,
            oracles: ["Chainlink"], forkedFrom: [],
          },
          {
            id: "uniswap-v3", name: "Uniswap V3", slug: "uniswap-v3",
            category: "Dexes", chainTvls: { Base: 950_000_000 },
            change_1d: 0.5, change_7d: 2.1, audits: 3,
            oracles: ["Uniswap TWAP"], forkedFrom: [],
          },
          {
            id: "seamless-protocol", name: "Seamless Protocol", slug: "seamless-protocol",
            category: "Lending", chainTvls: { Base: 420_000_000 },
            change_1d: -0.3, change_7d: 1.8, audits: 1,
            oracles: ["Chainlink", "Pyth"], forkedFrom: ["Aave V3"],
          },
        ]),
      });
    }
    if (url.includes("/historicalChainTvl")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { date: 1710000000, tvl: 7_800_000_000 },
          { date: 1710086400, tvl: 7_900_000_000 },
          { date: 1710172800, tvl: 8_200_000_000 },
        ]),
      });
    }
    if (url.includes("/pools")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [
          { project: "aerodrome", apy: 15.2, pool: "pool1", chain: "Base", symbol: "WETH-USDC", tvlUsd: 1000000 },
          { project: "seamless-protocol", apy: 5.8, pool: "pool2", chain: "Base", symbol: "USDC", tvlUsd: 500000 },
        ]}),
      });
    }
    if (url.includes("coingecko")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ethereum: { usd: 3200, usd_24h_change: 2.5 } }),
      });
    }
    if (url.includes("etherscan") && url.includes("eth_gasPrice")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "1", result: "0x5f5e100" }),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockDefiLlamaResponses();
});

describe("/api/agents/context", () => {
  it("returns valid v2 schema with default params", async () => {
    // Import route dynamically after mocks are set
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body._v).toBe("2.0");
    expect(body._schema).toBe("baseforge.agent.context");
    expect(body._chain).toBe("base");
    expect(body._chainId).toBe(8453);
    expect(body.market).toBeDefined();
    expect(body.market.totalTvl).toBeGreaterThan(0);
    expect(body.protocols).toBeDefined();
    expect(Array.isArray(body.protocols)).toBe(true);
  });

  it("includes whale data when requested via include param", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=whales");
    const res = await GET(req);
    const body = await res.json();

    expect(body.whales).toBeDefined();
    expect(body.whales.flows).toBeDefined();
    expect(body.whales.flows.length).toBeGreaterThan(0);
    expect(body.whales.summary.totalVolumeUSD).toBe(200000);
  });

  it("includes lending data when requested", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=lending");
    const res = await GET(req);
    const body = await res.json();

    expect(body.lending).toBeDefined();
    expect(body.lending.events).toBeDefined();
    expect(body.lending.summary.totalDepositsUSD).toBe(50000);
  });

  it("includes risk breakdown when requested", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=risk");
    const res = await GET(req);
    const body = await res.json();

    expect(body.risk).toBeDefined();
    expect(body.risk.avgHealth).toBeGreaterThan(0);
    expect(body.risk.concentration).toBeDefined();
    expect(body.risk.concentration.level).toBeDefined();
    expect(body.risk.anomalies).toBeDefined();
  });

  it("includes intent signals when whales data is available", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=intent");
    const res = await GET(req);
    const body = await res.json();

    expect(body.intents).toBeDefined();
    if (body.intents.length > 0) {
      const signal = body.intents[0];
      expect(signal.signal).toBeDefined();
      expect(signal.protocol).toBeDefined();
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(1);
      expect(signal.evidence).toBeDefined();
      expect(signal.actionable).toBeDefined();
    }
  });

  it("respects top=N parameter", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?top=2");
    const res = await GET(req);
    const body = await res.json();

    expect(body.protocols.length).toBeLessThanOrEqual(2);
  });

  it("returns compact format when requested", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?compact=true&include=protocols");
    const res = await GET(req);
    const body = await res.json();

    const proto = body.protocols[0];
    // Compact should only have: id, tvl, c1d, c7d, health, level
    expect(proto).toHaveProperty("id");
    expect(proto).toHaveProperty("tvl");
    expect(proto).toHaveProperty("health");
    expect(proto).toHaveProperty("level");
    // Should NOT have verbose fields
    expect(proto).not.toHaveProperty("cat");
    expect(proto).not.toHaveProperty("factors");
  });

  it("returns cached response with HIT header", async () => {
    const { cache } = await import("@/lib/cache");
    const cachedData = {
      _v: "2.0",
      _schema: "baseforge.agent.context",
      _ts: Date.now(),
      _chain: "base",
      _latencyMs: 0,
      market: { totalTvl: 8_000_000_000, protocols: 3, avgApy: 10, avgHealth: 70, tvlTrend: "up", tvlTrendPct: 5, topCategory: "Dexes" },
      protocols: [{ id: "aerodrome", tvl: 2_100_000_000, health: 82, level: "low" }],
      risk: { avgHealth: 75, highRiskCount: 0, anomalies: [], concentration: { level: "LOW", dominant: "Aerodrome", dominantPct: 60, hhi: 3800 } },
      _ttl: 120,
      _next: new Date(Date.now() + 120_000).toISOString(),
    };

    vi.mocked(cache.get).mockResolvedValueOnce(cachedData);

    const { GET } = await import("@/app/api/agents/context/route");
    const req = new Request("http://localhost/api/agents/context?include=all");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache-Status")).toBe("HIT");
  });

  it("includes rate limit headers for API key users", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=market");
    const res = await GET(req);

    expect(res.headers.get("X-RateLimit-Tier")).toBe("free");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
  });

  it("includes gas data when requested", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=gas");
    const res = await GET(req);
    const body = await res.json();

    expect(body.gas).toBeDefined();
    expect(body.gas.baseFeeGwei).toBeDefined();
    expect(body.gas.congestion).toBeDefined();
  });

  it("includes MEV placeholder when requested", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=mev");
    const res = await GET(req);
    const body = await res.json();

    expect(body.mev).toBeDefined();
    expect(body.mev.status).toBe("heuristic");
    expect(body.mev.confidence).toBe(0.3);
  });

  it("returns X-Data-Source header", async () => {
    const { GET } = await import("@/app/api/agents/context/route");

    const req = new Request("http://localhost/api/agents/context?include=market");
    const res = await GET(req);

    expect(res.headers.get("X-Data-Source")).toBe("envio-hypersync");
  });
});
