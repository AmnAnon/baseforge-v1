// src/__tests__/unit/circuit-breaker.test.ts
// Tests for the circuit breaker: state transitions, retry, cooldown.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker";

// Suppress logger output
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
}));

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker("test", { threshold: 3, cooldownMs: 100 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in closed state", () => {
    expect(cb.state).toBe("closed");
    expect(cb.isOpen).toBe(false);
  });

  it("stays closed on successful execution", async () => {
    const result = await cb.execute(async () => "success");
    expect(result).toBe("success");
    expect(cb.state).toBe("closed");
  });

  it("tracks failures and opens after threshold", async () => {
    const failing = async () => { throw new Error("fail"); };

    await expect(cb.execute(failing)).rejects.toThrow();
    await expect(cb.execute(failing)).rejects.toThrow();
    expect(cb.state).toBe("closed"); // 2 failures, threshold=3

    await expect(cb.execute(failing)).rejects.toThrow();
    expect(cb.state).toBe("open"); // 3 failures → open
  });

  it("throws CircuitOpenError when open", async () => {
    const failing = async () => { throw new Error("fail"); };

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failing); } catch { /* expected */ }
    }
    expect(cb.state).toBe("open");

    await expect(cb.execute(async () => "ok")).rejects.toThrow(CircuitOpenError);
  });

  it("transitions to half-open after cooldown", async () => {
    const failing = async () => { throw new Error("fail"); };

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failing); } catch { /* expected */ }
    }
    expect(cb.state).toBe("open");

    vi.advanceTimersByTime(150);
    expect(cb.state).toBe("half-open");
  });

  it("closes on success in half-open state", async () => {
    const failing = async () => { throw new Error("fail"); };

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failing); } catch { /* expected */ }
    }
    vi.advanceTimersByTime(150);
    expect(cb.state).toBe("half-open");

    const result = await cb.execute(async () => "recovered");
    expect(result).toBe("recovered");
    expect(cb.state).toBe("closed");
  });

  it("reopens on failure in half-open state", async () => {
    const failing = async () => { throw new Error("fail"); };

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failing); } catch { /* expected */ }
    }
    vi.advanceTimersByTime(150);
    expect(cb.state).toBe("half-open");

    await expect(cb.execute(failing)).rejects.toThrow();
    expect(cb.state).toBe("open");
  });

  it("resets failure count on success", async () => {
    const failing = async () => { throw new Error("fail"); };

    await expect(cb.execute(failing)).rejects.toThrow();
    await expect(cb.execute(failing)).rejects.toThrow();

    await cb.execute(async () => "ok");
    expect(cb.state).toBe("closed");

    // Need 3 more failures to open again
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failing); } catch { /* expected */ }
    }
    expect(cb.state).toBe("open");
  });

  it("manual reset returns to closed state", async () => {
    const failing = async () => { throw new Error("fail"); };

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failing); } catch { /* expected */ }
    }
    expect(cb.state).toBe("open");

    cb.reset();
    expect(cb.state).toBe("closed");
  });

  it("provides metrics snapshot with expected properties", async () => {
    const { circuitBreakers } = await import("@/lib/circuit-breaker");
    const envio = circuitBreakers.envio;
    const snap = envio.metricsSnapshot; // getter, not a method
    expect(snap).toHaveProperty("state");
    expect(snap).toHaveProperty("failures");
    expect(snap).toHaveProperty("successes");
    expect(snap).toHaveProperty("lastFailureAt");
    expect(snap).toHaveProperty("lastStateChangeAt");
  });
});

describe("CircuitOpenError", () => {
  it("has correct message and name", () => {
    const err = new CircuitOpenError("envio", 30_000);
    expect(err.name).toBe("CircuitOpenError");
    expect(err.message).toContain("envio");
    expect(err.message).toContain("30s");
  });
});

describe("Shared circuit breakers", () => {
  it("has all expected instances", async () => {
    const { circuitBreakers } = await import("@/lib/circuit-breaker");
    expect(circuitBreakers).toHaveProperty("envio");
    expect(circuitBreakers).toHaveProperty("etherscan");
    expect(circuitBreakers).toHaveProperty("defillama");
    expect(circuitBreakers).toHaveProperty("coingecko");
  });

  it("all start in closed state", async () => {
    const { circuitBreakers } = await import("@/lib/circuit-breaker");
    for (const [_name, cb] of Object.entries(circuitBreakers)) {
      expect(cb.state).toBe("closed");
    }
  });
});
