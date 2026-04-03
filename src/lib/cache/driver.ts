/**
 * Cache Abstraction Layer — Swappable Backend
 * 
 * Usage:
 *   - Development: InMemoryCache (current)
 *   - Production:  UpstashRedisCache (drop-in swap)
 * 
 * Swap by changing the import in API routes:
 *   FROM: import { cache } from "@/lib/cache/in-memory"
 *   TO:   import { cache } from "@/lib/cache/upstash-redis"
 */

export interface CacheDriver {
  /** Get cached value by key */
  get<T>(key: string): Promise<T | null>;

  /** Set value with TTL in seconds */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /** Delete specific key */
  delete(key: string): Promise<void>;

  /** Clear all cached data */
  clear(): Promise<void>;

  /** Get cache stats */
  stats(): Promise<{ size: number; hitRate: number }>;
}

/** Cache TTL presets (in seconds) */
export const TTL = {
  PRICES: 60,           // 1m — prices change fastest
  WHALES: 90,           // 1.5m — whale tx are time-sensitive
  TVL: 300,             // 5m — TVL moves slowly
  YIELDS: 300,          // 5m — yield data stable
  PROTOCOLS: 600,       // 10m — protocol list rarely changes
  RISK: 600,            // 10m — risk analysis heavy
  AGGREGATOR: 900,      // 15m — aggregated data heaviest
  STREAM: 30,           // 30s — SSE update interval
} as const;

/** Helper: memoized getOrFetch pattern */
export async function cachedFetch<T>(
  cache: CacheDriver,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = await cache.get<T>(key);
  if (existing !== null) return existing;

  const fresh = await fetcher();
  await cache.set(key, fresh, ttl);
  return fresh;
}
