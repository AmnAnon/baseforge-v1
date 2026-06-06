import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolveCacheBackend,
  usesCronBackgroundJobs,
  DEFILLAMA_HEALTH_URL,
} from "@/lib/env-config";

describe("resolveCacheBackend", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to memory without DATABASE_URL", () => {
    expect(resolveCacheBackend()).toBe("memory");
  });

  it("defaults to postgres when DATABASE_URL is set", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("CACHE_BACKEND", "");
    expect(resolveCacheBackend()).toBe("postgres");
  });

  it("forces postgres in production even if CACHE_BACKEND=memory", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("CACHE_BACKEND", "memory");
    expect(resolveCacheBackend()).toBe("postgres");
  });

  it("maps legacy upstash to postgres", () => {
    vi.stubEnv("CACHE_BACKEND", "upstash");
    expect(resolveCacheBackend()).toBe("postgres");
  });
});

describe("usesCronBackgroundJobs", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is true when CRON_SECRET set and WORKER_URL unset", () => {
    vi.stubEnv("CRON_SECRET", "secret");
    expect(usesCronBackgroundJobs()).toBe(true);
  });

  it("is false when WORKER_URL is set", () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("WORKER_URL", "https://worker.example.com");
    expect(usesCronBackgroundJobs()).toBe(false);
  });
});

describe("DEFILLAMA_HEALTH_URL", () => {
  it("uses protocols endpoint (healthy path returns 404)", () => {
    expect(DEFILLAMA_HEALTH_URL).toBe("https://api.llama.fi/protocols");
  });
});