/**
 * In-Memory Cache Driver
 * TTL-based, LRU eviction optional.
 * For production, replace with UpstashRedisCache below.
 */

import { CacheDriver } from "./driver";

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // ms timestamp
}

export class InMemoryCache implements CacheDriver {
  private store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async stats(): Promise<{ size: number; hitRate: number }> {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// ====================================================================
// Upstash Redis Cache — Drop-in Replacement (uncomment when ready)
// ====================================================================

// import { Redis } from "@upstash/redis";
//
// export class UpstashRedisCache implements CacheDriver {
//   private redis: Redis;
//   private keyPrefix: string;
//
//   constructor(url: string, token: string, prefix = "bf:") {
//     this.redis = new Redis({ url, token });
//     this.keyPrefix = prefix;
//   }
//
//   private key(k: string): string {
//     return `${this.keyPrefix}${k}`;
//   }
//
//   async get<T>(key: string): Promise<T | null> {
//     const data = await this.redis.get<T>(this.key(key));
//     return data ?? null;
//   }
//
//   async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
//     await this.redis.set(this.key(key), JSON.stringify(value), {
//       ex: ttlSeconds,
//     });
//   }
//
//   async delete(key: string): Promise<void> {
//     await this.redis.del(this.key(key));
//   }
//
//   async clear(): Promise<void> {
//     // Upstash doesn't support FLUSHDB — iterate keys by prefix
//     const keys = await this.redis.keys(`${this.keyPrefix}*`);
//     if (keys.length > 0) await this.redis.del(...keys);
//   }
//
//   async stats(): Promise<{ size: number; hitRate: number }> {
//     const keys = await this.redis.keys(`${this.keyPrefix}*`);
//     return { size: keys.length, hitRate: 0 };
//   }
// }

// ====================================================================
// Default Export — Change this one line to swap backends.
// ====================================================================

export const cache = new InMemoryCache();

// To switch to Upstash Redis:
// export const cache = new UpstashRedisCache(
//   process.env.UPSTASH_REDIS_URL!,
//   process.env.UPSTASH_REDIS_TOKEN!
// );
