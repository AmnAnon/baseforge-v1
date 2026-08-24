// src/__tests__/integration/agent-stats.test.ts
// Integration tests for GET /api/agents/stats.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/lib/db/client", () => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { tier: "free", total: 10 },
                { tier: "pro", total: 2 },
              ]),
            }),
          }),
        }),
        groupBy: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { endpoint: "/api/agents/context", requests: 100 },
            ]),
          }),
        }),
      }),
    }),
  };
  return { db: mockDb };
});

describe("GET /api/agents/stats", () => {
  it("returns 200 with schema baseforge.agent.stats", async () => {
    const { GET } = await import("@/app/api/agents/stats/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body._v).toBe("2.0");
    expect(body._schema).toBe("baseforge.agent.stats");
    expect(body.overview).toBeDefined();
    expect(body.overview.totalApiKeys).toBeGreaterThanOrEqual(0);
    expect(body.keysByTier).toBeDefined();
    expect(body.dailyTrend).toBeDefined();
    expect(Array.isArray(body.dailyTrend)).toBe(true);
    expect(body.endpoints).toBeDefined();
    expect(body.statusBreakdown).toBeDefined();
    expect(body.agentClients).toBeDefined();
  });

  it("handles OPTIONS CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/agents/stats/route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
