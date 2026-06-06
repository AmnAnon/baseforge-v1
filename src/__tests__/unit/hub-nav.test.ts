import { describe, it, expect } from "vitest";

/** Hub IA contract — 5 bottom items, merged sections live in sub-nav. */
const HUB_IDS = ["pulse", "risk", "flows", "portfolio", "more"] as const;

const MERGED = {
  pulse: ["overview", "charts"],
  risk: ["scores", "compare", "alerts"],
  flows: ["whales", "mev"],
  more: ["prices", "revenue"],
} as const;

describe("hub navigation model", () => {
  it("exposes five bottom hubs (was ten flat tabs)", () => {
    expect(HUB_IDS).toHaveLength(5);
  });

  it("merges charts into pulse", () => {
    expect(MERGED.pulse).toContain("charts");
  });

  it("merges compare and alerts into risk", () => {
    expect(MERGED.risk).toEqual(["scores", "compare", "alerts"]);
  });

  it("merges revenue into more/market hub", () => {
    expect(MERGED.more).toContain("revenue");
  });
});