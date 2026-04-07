import { describe, it, expect } from "vitest";
import { calculateHealthScore } from "@/lib/protocol-aggregator";

describe("calculateHealthScore", () => {
  function makeProto(overrides: Record<string, unknown> = {}) {
    return {
      audits: 2,
      tvl: 10_000_000,
      tvlChange24h: 0,
      tvlChange7d: 0,
      category: "Lending",
      oracles: ["Chainlink", "Band"],
      forkedFrom: [] as string[],
      apy: 5,
      ...overrides,
    };
  }

  it("returns a score between 0 and 100 for a healthy protocol", () => {
    const proto = makeProto();
    const result = calculateHealthScore(proto);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.riskFactors).toEqual([]);
  });

  it("returns 0-100 with zero TVL", () => {
    const proto = makeProto({ tvl: 0 });
    const result = calculateHealthScore(proto);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.riskFactors).toContain("Low TVL");
  });

  it("penalizes unaudited protocols", () => {
    const proto = makeProto({ audits: 0 });
    const result = calculateHealthScore(proto);
    expect(result.riskFactors).toContain("No audits");
  });

  it("flags high 7d TVL volatility", () => {
    const proto = makeProto({ tvlChange7d: -30 });
    const result = calculateHealthScore(proto);
    expect(result.riskFactors).toContain("High TVL volatility");
  });

  it("flags TVL decline without triggering volatility", () => {
    const proto = makeProto({ tvlChange7d: -15 });
    const result = calculateHealthScore(proto);
    expect(result.riskFactors).toContain("TVL declining");
    expect(result.riskFactors).not.toContain("High TVL volatility");
  });

  it("flags extreme 24h TVL swing", () => {
    const proto = makeProto({ tvlChange24h: -20 });
    const result = calculateHealthScore(proto);
    expect(result.riskFactors).toContain("Extreme 24h TVL swing");
  });

  it("flags low oracle diversity", () => {
    const proto = makeProto({ oracles: ["Chainlink"] });
    const result = calculateHealthScore(proto);
    expect(result.riskFactors).toContain("Limited oracle diversity");
  });

  it("flags suspiciously high APY", () => {
    const proto = makeProto({ apy: 5000 });
    const result = calculateHealthScore(proto);
    expect(result.riskFactors).toContain("Suspiciously high APY");
  });

  it("rewards forked protocols with a small bonus", () => {
    const healthy = makeProto();
    const forked = makeProto({ forkedFrom: ["Aave"] });
    const healthyScore = calculateHealthScore(healthy).score;
    const forkedScore = calculateHealthScore(forked).score;
    expect(forkedScore).toBeGreaterThan(healthyScore);
  });

  it("handles missing/unknown category gracefully", () => {
    const proto = makeProto({ category: "Experimental" });
    const result = calculateHealthScore(proto);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("caps score at 100 when all bonuses apply", () => {
    const proto = makeProto({
      audits: 10,
      tvl: 500_000_000,
      category: "Liquid Staking",
      forkedFrom: ["Aave", "Compound"],
      tvlChange24h: 1,
      tvlChange7d: 2,
    });
    const result = calculateHealthScore(proto);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("clamps score at 0 for worst-case protocol", () => {
    const proto = makeProto({
      audits: 0,
      tvl: 100,
      tvlChange24h: -50,
      tvlChange7d: -80,
      oracles: [],
      apy: 99999,
    });
    const result = calculateHealthScore(proto);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
