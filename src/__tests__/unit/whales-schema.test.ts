import { describe, it, expect } from "vitest";
import { WhalesResponseSchema } from "@/lib/zod/schemas";

describe("WhalesResponseSchema", () => {
  it("accepts full cockpit payload with source and meta", () => {
    const payload = {
      whales: [{ hash: "0xabc", valueUSD: 50_000 }],
      whaleProfiles: [{ address: "0x1", score: 80, txCount: 3, totalVolume: 100_000, protocols: ["aerodrome"], lastSeen: new Date().toISOString() }],
      hotSignals: [{ id: "sig-1", type: "accumulation", description: "test", confidence: 0.8, transactions: ["0xabc"] }],
      summary: {
        total: 1,
        largest: 50_000,
        avgSize: 50_000,
        types: { swap: 1 },
        activeWhales: 1,
        totalVolumeUSD: 50_000,
      },
      source: "envio-hypersync",
      timestamp: Date.now(),
      isStale: false,
      meta: { hint: "none", minUsd: 5000, indexer: "envio-hypersync" },
    };

    const result = WhalesResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("envio-hypersync");
      expect(result.data.whaleProfiles).toHaveLength(1);
      expect(result.data.summary.activeWhales).toBe(1);
    }
  });
});