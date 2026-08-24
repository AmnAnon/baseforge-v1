// src/__tests__/integration/wallet-airdrop.test.ts
// Integration tests for /api/wallet/airdrop and /api/wallet/intelligence.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getOrFetch: vi.fn().mockImplementation((_key, _ttl, fn) => fn()),
    stats: () => ({ size: 0, hitRate: 0 }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/viem/client", () => ({
  basePublicClient: {
    getTransactionCount: vi.fn().mockResolvedValue(42),
    getBalance: vi.fn().mockResolvedValue(BigInt("500000000000000000")), // 0.5 ETH
    multicall: vi.fn().mockResolvedValue([
      { status: "success", result: BigInt("1000000000000000000000") },
      { status: "success", result: BigInt("500000000") },
    ]),
  },
}));

describe("Phase 4: Wallet Intelligence & Airdrop Scoring", () => {
  const TEST_WALLET = "0x27e661832ba96a322ab158352fa2e106ee3512e1";

  describe("GET /api/wallet/airdrop", () => {
    it("returns 400 when address is missing or invalid", async () => {
      const { GET } = await import("@/app/api/wallet/airdrop/route");
      const req = new Request("http://localhost:3000/api/wallet/airdrop");
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it("returns 200 with complete score, tier, and checklist for valid address", async () => {
      const { GET } = await import("@/app/api/wallet/airdrop/route");
      const req = new Request(`http://localhost:3000/api/wallet/airdrop?address=${TEST_WALLET}`);
      const res = await GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.address).toBe(TEST_WALLET);
      expect(body.score).toBeGreaterThanOrEqual(0);
      expect(body.score).toBeLessThanOrEqual(100);
      expect(["Bronze", "Silver", "Gold", "Platinum", "Diamond"]).toContain(body.tier);
      expect(body.percentile).toBeDefined();
      expect(body.sybilScore).toBeDefined();
      expect(body.breakdown).toBeDefined();
      expect(body.breakdown.volume).toBeDefined();
      expect(body.breakdown.protocols).toBeDefined();
      expect(Array.isArray(body.checklist)).toBe(true);
      expect(body.checklist.length).toBeGreaterThan(0);
      expect(Array.isArray(body.protocols)).toBe(true);
      expect(Array.isArray(body.boosters)).toBe(true);
      expect(body.shareable).toBeDefined();
      expect(body.shareable.warpcastText).toContain("Base");
    });
  });

  describe("GET /api/wallet/intelligence", () => {
    it("returns 200 with persona clustering and whale adjacency", async () => {
      const { GET } = await import("@/app/api/wallet/intelligence/route");
      const req = new Request(`http://localhost:3000/api/wallet/intelligence?address=${TEST_WALLET}`);
      const res = await GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.address).toBe(TEST_WALLET);
      expect(body.persona).toBeDefined();
      expect(body.riskAppetite).toBeDefined();
      expect(body.whaleAdjacency).toBeDefined();
      expect(body.whaleAdjacency.similarityScore).toBeGreaterThanOrEqual(0);
      expect(body.portfolioHealth).toBeDefined();
      expect(body.portfolioHealth.safetyScore).toBeDefined();
    });
  });
});
