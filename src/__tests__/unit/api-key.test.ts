// src/__tests__/unit/api-key.test.ts
// Tests for API key generation and middleware behavior.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ── Mutable mock state ─────────────────────────────────────────

let mockDbSelectResult: unknown[] = [];

// ── Mock DB client ─────────────────────────────────────────────

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: () => Promise.resolve(undefined),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelectResult,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(undefined),
      }),
    }),
  },
}));

// ── Mock rate limiter ──────────────────────────────────────────

let mockRateAllowed = true;
let mockRateRetryAfter = 60;

vi.mock("@/lib/rate-limit", () => ({
  RateLimiter: class {
    check() { return { allowed: mockRateAllowed, retryAfter: mockRateRetryAfter, remaining: 99 }; }
  },
  rateLimiterMiddleware: () => () => null,
}));

// ── Mock logger ────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
}));

describe("API Key Generation", () => {
  it("generates a key with bf_ prefix", async () => {
    const { generateApiKey } = await import("@/lib/api-key");
    const { raw } = generateApiKey();
    expect(raw.startsWith("bf_")).toBe(true);
    expect(raw.length).toBeGreaterThan(20);
  });

  it("generates unique keys each time", async () => {
    const { generateApiKey } = await import("@/lib/api-key");
    const { raw: key1 } = generateApiKey();
    const { raw: key2 } = generateApiKey();
    expect(key1).not.toBe(key2);
  });

  it("hash is SHA-256 hex of raw", async () => {
    const { generateApiKey } = await import("@/lib/api-key");
    const { raw, hash } = generateApiKey();
    const expected = createHash("sha256").update(raw).digest("hex");
    expect(hash).toBe(expected);
  });
});

describe("API Key Middleware", () => {
  const validKeyRecord = {
    id: "test-key-id-123",
    key: "test-hash",
    name: "Test Key",
    tier: "free",
    rateLimit: 100,
    enabled: true,
    lastUsedAt: null,
    totalRequests: 5,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDbSelectResult = [validKeyRecord];
    mockRateAllowed = true;
    mockRateRetryAfter = 60;
  });

  it("returns 401 when key is required but not provided", async () => {
    mockDbSelectResult = [];
    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test");
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response).not.toBeNull();
    expect(result.response!.status).toBe(401);
    const body = await result.response!.json();
    expect(body.error).toBe("API key required");
  });

  it("allows through when key is not required", async () => {
    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test");
    const result = await apiKeyMiddleware(req, { required: false });

    expect(result.response).toBeNull();
    expect(result.key).toBeNull();
  });

  it("returns 403 for invalid key (not found in DB)", async () => {
    mockDbSelectResult = [];
    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test", {
      headers: { "x-api-key": "bf_invalid_key" },
    });
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.error).toBe("Invalid API key");
  });

  it("accepts key via X-API-Key header", async () => {
    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test", {
      headers: { "x-api-key": "bf_valid_key" },
    });
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response).toBeNull();
    expect(result.key).not.toBeNull();
    expect(result.key!.name).toBe("Test Key");
  });

  it("accepts key via ?apiKey= query param", async () => {
    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test?apiKey=bf_valid_key");
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response).toBeNull();
    expect(result.key).not.toBeNull();
  });

  it("provides trackUsage function", async () => {
    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test", {
      headers: { "x-api-key": "bf_valid_key", "x-forwarded-for": "1.2.3.4", "user-agent": "TestAgent/1.0" },
    });
    const result = await apiKeyMiddleware(req, { required: true });

    expect(typeof result.trackUsage).toBe("function");
    // Calling it shouldn't throw
    expect(() => result.trackUsage(200, 150, req)).not.toThrow();
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockRateAllowed = false;
    mockRateRetryAfter = 30;

    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test", {
      headers: { "x-api-key": "bf_valid_key" },
    });
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response!.status).toBe(429);
    const body = await result.response!.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.retryAfter).toBe(30);
  });

  it("rejects revoked keys", async () => {
    mockDbSelectResult = [{ ...validKeyRecord, revokedAt: new Date() }];

    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test", {
      headers: { "x-api-key": "bf_revoked_key" },
    });
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response!.status).toBe(403);
  });

  it("rejects disabled keys", async () => {
    mockDbSelectResult = [{ ...validKeyRecord, enabled: false }];

    const { apiKeyMiddleware } = await import("@/lib/api-key");
    const req = new Request("http://localhost/api/test", {
      headers: { "x-api-key": "bf_disabled_key" },
    });
    const result = await apiKeyMiddleware(req, { required: true });

    expect(result.response!.status).toBe(403);
  });
});
