// src/__tests__/unit/logger.test.ts
// Tests for structured logger and timing helper.

import { describe, it, expect, vi } from "vitest";

describe("Logger", () => {
  it("outputs structured JSON in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();

    const { logger } = await import("@/lib/logger");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("structured test", { metric: 42 });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const jsonStr = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("structured test");
    expect(parsed.ctx?.metric).toBe(42);
    expect(parsed.ts).toMatch(/^\d{4}-/);

    logSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("Timing helper", () => {
  it("measures elapsed milliseconds", async () => {
    const { timing } = await import("@/lib/logger");
    const end = timing("test-op");

    await new Promise((r) => setTimeout(r, 10));

    const elapsed = end();
    expect(elapsed).toBeGreaterThanOrEqual(5);
    expect(elapsed).toBeLessThan(1000);
  });
});
