// src/lib/cache.ts
// Unified Cache Abstraction — Postgres-Backed (Neon).
// Consolidation phase: Removed Redis dependency in favor of direct SQL caching.

import { db } from "./db/client";
import { apiCache } from "./db/schema";
import { eq, lt } from "drizzle-orm";
import { logger } from "./logger";
import { getCacheMisconfiguration, resolveCacheBackend } from "./env-config";

const CACHE_BACKEND = resolveCacheBackend();
const CACHE_MISCONFIG = getCacheMisconfiguration();
if (CACHE_MISCONFIG) {
  logger.error("[Cache] Misconfiguration", { detail: CACHE_MISCONFIG, backend: CACHE_BACKEND });
}

// ─── In-Memory Driver (Fallback for dev) ───────────────────────

interface MemoryEntry { value: unknown; expiresAt: number }

class MemoryCacheBackend implements CacheBackendIface {
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

  async getStale<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> { this.store.delete(key); }
  async clear(): Promise<void> { this.store.clear(); this.hits = 0; this.misses = 0; }
  stats(): { size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { size: this.store.size, hitRate: total > 0 ? this.hits / total : 0 };
  }
}

// ─── Postgres Driver (Production Standard) ────────────────────

class PostgresCacheBackend implements CacheBackendIface {
  async get<T>(key: string): Promise<T | null> {
    try {
      const results = await db.select().from(apiCache).where(eq(apiCache.key, key)).limit(1);
      if (results.length === 0) return null;
      const entry = results[0];
      if (new Date() > entry.expiresAt) return null;
      return entry.value as T;
    } catch (err) {
      logger.error("[PostgresCache] get failed", { error: String(err) });
      return null;
    }
  }

  async getStale<T>(key: string): Promise<T | null> {
    try {
      const results = await db.select().from(apiCache).where(eq(apiCache.key, key)).limit(1);
      if (results.length === 0) return null;
      return results[0].value as T;
    } catch { return null; }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await db
        .insert(apiCache)
        .values({ key, value: value as Record<string, unknown>, expiresAt })
        .onConflictDoUpdate({
          target: apiCache.key,
          set: { value: value as Record<string, unknown>, expiresAt, createdAt: new Date() },
        });
    } catch (err) {
      logger.error("[PostgresCache] set failed", { error: String(err) });
    }
  }

  async del(key: string): Promise<void> {
    try { await db.delete(apiCache).where(eq(apiCache.key, key)); } catch {}
  }

  async clear(): Promise<void> {
    try { await db.delete(apiCache); } catch {}
  }

  stats(): { size: number; hitRate: number } { return { size: 0, hitRate: 0 }; }
}

// ─── Singleton ──────────────────────────────────────────

interface CacheBackendIface {
  get<T>(key: string): Promise<T | null>;
  getStale?<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): { size: number; hitRate: number };
}

let driver: CacheBackendIface;

if (CACHE_BACKEND === "memory") {
  driver = new MemoryCacheBackend();
} else {
  // Default to Postgres
  driver = new PostgresCacheBackend();
}

// ─── Public API ──────────────────────────────────────────

const inflight = new Map<string, Promise<unknown>>();

export const cache = {
  get: <T>(key: string): Promise<T | null> => driver.get<T>(key),
  getStale: <T>(key: string): Promise<T | null> => {
    if (typeof driver.getStale === "function") return driver.getStale<T>(key);
    return driver.get<T>(key);
  },
  set: <T>(key: string, value: T, ttl: number): Promise<void> => driver.set<T>(key, value, ttl),
  del: (key: string): Promise<void> => driver.del(key),
  clear: (): Promise<void> => { inflight.clear(); return driver.clear(); },
  stats: (): { size: number; hitRate: number } => driver.stats(),

  /** Cache-aside with single-flight. */
  getOrFetch: async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
    const ttlSeconds = Math.round(ttlMs / 1000);
    const cached = await driver.get<T>(key);
    if (cached !== null) return cached;

    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher().then(
      (fresh) => {
        inflight.delete(key);
        return driver.set(key, fresh, ttlSeconds).then(() => fresh);
      },
      (err) => { inflight.delete(key); throw err; }
    );
    inflight.set(key, promise);
    return promise as Promise<T>;
  },

  /** Cache-aside with stale fallback. */
  getWithStaleFallback: async <T extends Record<string, unknown>>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
  ): Promise<T & { isStale: boolean; _stale?: boolean; _staleAge?: number }> => {
    const ttlSeconds = Math.round(ttlMs / 1000);
    const cached = await driver.get<T>(key);
    if (cached !== null) return cached as T & { isStale: boolean };

    try {
      const fresh = await fetcher();
      await driver.set(key, { ...fresh, isStale: false }, ttlSeconds);
      return { ...fresh, isStale: false };
    } catch {
      const stale =
        typeof driver.getStale === "function" ? await driver.getStale<T>(key) : null;
      if (stale !== null) {
        return { ...stale, isStale: true, _stale: true };
      }
      const retry = await fetcher();
      return { ...retry, isStale: true };
    }
  },
};

export const CACHE_TTL = {
  PRICES: 60_000,
  PROTOCOL_LIST: 600_000,
  TVL_HISTORY: 300_000,
  WHALE_TX: 60_000,
  RISK_ANALYSIS: 600_000,
  YIELDS: 300_000,
} as const;
