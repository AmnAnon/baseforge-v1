// src/__tests__/utils.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercentage, timeAgo, freshnessColor } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats large numbers with compact notation", () => {
    const result = formatCurrency(1_000_000);
    expect(result).toContain("M");
  });

  it("returns N/A for null/undefined/NaN", () => {
    expect(formatCurrency(undefined)).toBe("N/A");
    expect(formatCurrency(null)).toBe("N/A");
    expect(formatCurrency(NaN)).toBe("N/A");
  });

  it("appends unit when provided", () => {
    expect(formatCurrency(100, { unit: "TVL" })).toBe("$100 TVL");
  });
});

describe("formatPercentage", () => {
  it("formats positive values with +", () => {
    expect(formatPercentage(5.5)).toBe("+5.50%");
  });

  it("formats negative values with -", () => {
    expect(formatPercentage(-3.2)).toBe("-3.20%");
  });

  it("returns N/A for null", () => {
    expect(formatPercentage(null)).toBe("N/A");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for recent timestamps", () => {
    expect(timeAgo(Date.now())).toBe("just now");
  });

  it("returns seconds for recent timestamps", () => {
    const result = timeAgo(Date.now() - 30_000);
    expect(result).toMatch(/\d+s ago/);
  });

  it("returns minutes for 1-60m ago", () => {
    const result = timeAgo(Date.now() - 120_000);
    expect(result).toMatch(/\d+m ago/);
  });
});

describe("freshnessColor", () => {
  it("returns emerald for fresh data (< 1m)", () => {
    expect(freshnessColor(Date.now())).toBe("text-emerald-400");
  });

  it("returns yellow for slightly stale (1-5m)", () => {
    expect(freshnessColor(Date.now() - 120_000)).toBe("text-yellow-400");
  });

  it("returns red for stale data (> 5m)", () => {
    expect(freshnessColor(Date.now() - 400_000)).toBe("text-red-400");
  });
});
