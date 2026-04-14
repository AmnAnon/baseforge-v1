// src/__tests__/integration/protocol-aggregator.test.ts
// Tests the protocol aggregator route response shape.

import { describe, it, expect } from "vitest";

describe("/api/protocol-aggregator", () => {
  it("returns a 200 response", async () => {
    const { GET } = await import("@/app/api/protocol-aggregator/route");
    const res = await GET(new Request("http://localhost/api/protocol-aggregator"));
    expect(res.status).toBe(200);
  });

  it("returns an array (may be empty if upstream is unavailable in test env)", async () => {
    const { GET } = await import("@/app/api/protocol-aggregator/route");
    const res = await GET(new Request("http://localhost/api/protocol-aggregator"));
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
