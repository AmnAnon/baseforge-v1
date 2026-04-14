// src/__tests__/integration/risk-route.test.ts
// Tests /api/risk endpoint response shape.

import { describe, it, expect } from "vitest";

describe("/api/risk", () => {
  it("returns a 200 response", async () => {
    const { GET } = await import("@/app/api/risk/route");
    const res = await GET(new Request("http://localhost/api/risk"));
    expect(res.status).toBe(200);
  });

  it("returns the expected shape with summary", async () => {
    const { GET } = await import("@/app/api/risk/route");
    const res = await GET(new Request("http://localhost/api/risk"));
    const body = await res.json();

    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("summary");
    if (body.summary) {
      expect(body.summary).toHaveProperty("avgHealthScore");
      expect(body.summary).toHaveProperty("highRiskCount");
      expect(body.summary).toHaveProperty("concentrationRisk");
    }
    expect(Array.isArray(body.protocols)).toBe(true);
  });
});
