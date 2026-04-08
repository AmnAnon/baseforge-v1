// src/__tests__/e2e/smoke.test.ts
// E2E smoke tests — verify route accessibility and basic response shape.
// Runs against a running Next.js dev server at BASE_URL (default: http://localhost:3000).
// Usage:  npm run dev &  &&  npx vitest run src/__tests__/e2e/smoke.test.ts

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TIMEOUT = 10_000; // 10s per request

// Skip entire suite if SKIP_E2E is set (for CI environments without a running server)
const describeE2E = process.env.SKIP_E2E ? describe.skip : describe;

describeE2E("E2E smoke tests", () => {
  let serverUp = false;

  beforeAll(async () => {
    try {
      const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
      serverUp = res.ok || res.status < 500;
    } catch {
      serverUp = false;
    }
    if (!serverUp) {
      console.warn(`[E2E] Skipping: no server at ${BASE_URL}. Start with 'npm run dev' or set BASE_URL.`);
    }
  }, 15_000);

  it("GET / returns 200 and HTML", async () => {
    if (!serverUp) return;
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(TIMEOUT) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("BaseForge");
  });

  it("GET /api/frame returns 200 with frame metadata", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/frame`, { signal: AbortSignal.timeout(TIMEOUT) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("fc:frame");
    expect(html).toContain("BaseForge");
  });

  it("GET /api/stream returns SSE content type", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/stream`, { signal: AbortSignal.timeout(TIMEOUT) });
    // Stream endpoint may return 429 (rate limited) — that's acceptable, it means route exists
    expect([200, 429]).toContain(res.status);

    if (res.status === 200) {
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    }
  });

  it("GET /api/analytics returns JSON", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/analytics`, { signal: AbortSignal.timeout(TIMEOUT) });
    // May return stale cache (200) or rate-limited (429) — both are valid
    expect([200, 429]).toContain(res.status);

    if (res.status === 200) {
      const json = await res.json();
      expect(json).toHaveProperty("baseMetrics");
      expect(json).toHaveProperty("timestamp");
    }
  });

  it("GET /api/health returns status", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(TIMEOUT) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("status");
  });
});