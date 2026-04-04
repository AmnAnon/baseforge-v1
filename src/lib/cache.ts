// src/lib/cache.ts
// Cache abstraction — In-Memory (default) with Upstash Redis driver.
// Set CACHE_BACKEND="upstash" + UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN in .env.local.

import { Redis } from "@upstash/redis";

const CACHE_BACKEND = process.env.CACHE_BACKEND || "memory";

// ─── In-Memory Driver ───────────────────────────────────

interface MemoryEntry { value: unknown; expiresAt: number }

class MemoryCacheBackend {
  private store = new Map<string, MemoryEntry>();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) { this.store.delete(key); this.misses++; return null; }
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> { this.store.delete(key); }
  async clear(): Promise<void> { this.store.clear(); }
  stats(): { size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { size: this.store.size, hitRate: total > 0 ? this.hits / total : 0 };
  }
}

// ─── Upstash Redis Driver ─────────────────────────────

class UpstashCacheBackend {
  private redis: Redis;
  private keyPrefix = "bf:";

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get<string | null>(`${this.keyPrefix}${key}`);
    if (raw === null || raw === undefined) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await this.redis.set(`${this.keyPrefix}${key}`, serialized, { ex: ttlSeconds });
  }

  async del(key: string): Promise<void> { await this.redis.del(`${this.keyPrefix}${key}`); }
  async clear(): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    if (keys.length > 0) await this.redis.del(...keys);
  }
  stats(): { size: number; hitRate: number } { return { size: 0, hitRate: 0 }; }
}

// ─── Singleton ──────────────────────────────────────────

interface CacheBackendIface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): { size: number; hitRate: number };
}

let driver: CacheBackendIface;

if (CACHE_BACKEND === "upstash" && process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
  driver = new UpstashCacheBackend(process.env.UPSTASH_REDIS_URL, process.env.UPSTASH_REDIS_TOKEN);
} else {
  driver = new MemoryCacheBackend();
}

// ─── Public API — all async ────────────────────────────

export const cache = {
  get: <T>(key: string): Promise<T | null> => driver.get<T>(key),
  set: <T>(key: string, value: T, ttl: number): Promise<void> => driver.set<T>(key, value, ttl),
  del: (key: string): Promise<void> => driver.del(key),
  clear: (): Promise<void> => driver.clear(),
  stats: (): { size: number; hitRate: number } => driver.stats(),

  /** Cache-aside: getOrFetch(key, ttlMs, fetchFn) */
  getOrFetch: async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
    const ttlSeconds = Math.round(ttlMs / 1000);
    const cached = await driver.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    await driver.set(key, fresh, ttlSeconds);
    return fresh;
  },
};

// Preset TTLs — called in milliseconds by all API routes
export const CACHE_TTL = {
  PRICES: 60_000,
  PROTOCOL_LIST: 600_000,
  TVL_HISTORY: 300_000,
  WHALE_TX: 60_000,
  RISK_ANALYSIS: 600_000,
  YIELDS: 300_000,
} as const;
