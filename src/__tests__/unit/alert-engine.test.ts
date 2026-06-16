import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/seed", () => ({
  seedDefaultAlertRules: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("evaluateAlertRules", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
  });

  it("returns 0 when DATABASE_URL is unset", async () => {
    vi.unstubAllEnvs();
    const { evaluateAlertRules } = await import("@/lib/alert-engine");
    expect(await evaluateAlertRules()).toBe(0);
  });
});