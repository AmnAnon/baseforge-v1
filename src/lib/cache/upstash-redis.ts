// src/lib/cache/upstash-redis.ts
// Upstash Redis cache driver — drop-in replacement for in-memory cache.

import { CacheDriver } from "./driver";
import { Redis } from "@upstash/redis";

export class UpstashRedisCache implements CacheDriver {
  private redis: Redis;
  private keyPrefix: string;
  private hits = 0;
  private misses = 0;

  constructor(url?: string, token?: string, prefix = "bf:") {
    this.redis = new Redis({
      url: url ?? process.env.UPSTASH_REDIS_URL!,
      token: token ?? process.env.UPSTASH_REDIS_TOKEN!,
    });
    this.keyPrefix = prefix;
  }

  private key(k: string): string {
    return `${this.keyPrefix}${k}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get<string | null>(this.key(key));
    if (raw === null || raw === undefined) {
      this.misses++;
      return null;
    }
    this.hits++;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    return this.redis.set(this.key(key), serialized, { ex: ttlSeconds }).then(() => {});
  }

  delete(key: string): Promise<void> {
    return this.redis.del(this.key(key)).then(() => {});
  }

  clear(): Promise<void> {
    return this.redis.keys(`${this.keyPrefix}*`).then((keys) =>
      keys.length > 0 ? this.redis.del(...keys).then(() => {}) : Promise.resolve()
    );
  }

  async stats(): Promise<{ size: number; hitRate: number }> {
    const total = this.hits + this.misses;
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    return { size: keys.length, hitRate: total > 0 ? this.hits / total : 0 };
  }
}
