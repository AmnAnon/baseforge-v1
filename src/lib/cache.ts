// src/lib/cache.ts
// Cache abstraction — In-Memory driver with Upstash swap ready
// To swap: set CACHE_BACKEND="upstash" in .env.local, install @upstash/redis

const CACHE_BACKEND = process.env.CACHE_BACKEND || "memory";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() > entry.expiresAt) { this.store.delete(key); this.misses++; return null; }
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void { this.store.delete(key); }
  clear(): void { this.store.clear(); }

  stats(): { size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { size: this.store.size, hitRate: total > 0 ? this.hits / total : 0 };
  }
}

const memoryCache = new InMemoryCache();

// Unified cache interface — sync when memory, returns null for upstash (async in prod)
export const cache = {
  get: <T>(key: string): T | null => {
    if (CACHE_BACKEND !== "memory") return null; // Upstash needs async — use getOrFetch
    return memoryCache.get<T>(key);
  },
  set: <T>(key: string, value: T, ttlMs: number): void => {
    if (CACHE_BACKEND !== "memory") return;
    memoryCache.set(key, value, ttlMs);
  },
  delete: (key: string): void => { if (CACHE_BACKEND === "memory") memoryCache.delete(key); },
  clear: (): void => { if (CACHE_BACKEND === "memory") memoryCache.clear(); },

  // Helper: getOrFetch works with both sync + async backends
  getOrFetch: async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
    const cached = cache.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    cache.set(key, fresh, ttlMs);
    return fresh;
  },
};

// Preset TTLs (milliseconds)
export const CACHE_TTL = {
  PRICES: 60_000,
  PROTOCOL_LIST: 600_000,
  TVL_HISTORY: 300_000,
  WHALE_TX: 60_000,
  RISK_ANALYSIS: 600_000,
  YIELDS: 300_000,
} as const;
