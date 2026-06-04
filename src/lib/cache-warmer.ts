// src/lib/cache-warmer.ts
// Warms shared Postgres cache (protocols, TVL, prices, SSE stream payload).
// Used by Vercel Cron when no dedicated worker is deployed.

import { cache } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { apiCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

const BASE_TOKEN_IDS =
  "ethereum,usd-coin,dai,wrapped-bitcoin,chainlink,uniswap";

function getBaseTvl(p: { chainTvls?: Record<string, number> }): number {
  return (
    p.chainTvls?.["Base"] ??
    p.chainTvls?.["base"] ??
    p.chainTvls?.["BASE"] ??
    0
  );
}

async function incrementStreamVersion(): Promise<number> {
  try {
    const existing = await db
      .select()
      .from(apiCache)
      .where(eq(apiCache.key, "stream:version"))
      .limit(1);

    const next =
      existing.length > 0
        ? parseInt(String(existing[0].value), 10) + 1
        : 1;

    const farFuture = new Date("2099-01-01");
    await db
      .insert(apiCache)
      .values({ key: "stream:version", value: next, expiresAt: farFuture })
      .onConflictDoUpdate({
        target: apiCache.key,
        set: { value: next, expiresAt: farFuture },
      });

    return next;
  } catch (err) {
    logger.warn("incrementStreamVersion failed", { error: String(err) });
    return 0;
  }
}

export interface CacheWarmResult {
  ok: boolean;
  keys: string[];
  latencyMs: number;
  streamVersion?: number;
  error?: string;
}

/**
 * Fetch DefiLlama + CoinGecko and write api_cache keys used by SSE and analytics.
 */
export async function warmSharedCache(): Promise<CacheWarmResult> {
  const t0 = Date.now();
  const updatedKeys: string[] = [];

  let streamProtocols: Array<{
    id: string;
    name: string;
    tvl: number;
    change24h: number;
    logo: string;
    category: string;
  }> = [];
  let streamTvlHistory: Array<{ date: string; tvl: number }> = [];
  let streamTotalTvl = 0;
  let streamChange24h = 0;
  let streamPrices: Record<string, { usd: number; usd_24h_change?: number }> = {};

  try {
    const res = await fetch("https://api.llama.fi/protocols", {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const raw: Array<{
        name: string;
        slug?: string;
        logo?: string;
        category?: string;
        chains?: string[];
        chainTvls?: Record<string, number>;
        change_1d?: number;
        change_7d?: number;
      }> = await res.json();

      const EXCLUDED = new Set(["CEX", "Chain"]);
      const base20 = raw
        .filter(
          (p) =>
            p.chains?.includes("Base") === true &&
            !EXCLUDED.has(p.category ?? ""),
        )
        .sort((a, b) => getBaseTvl(b) - getBaseTvl(a))
        .slice(0, 20)
        .map((p) => ({
          id: p.slug ?? p.name.toLowerCase().replace(/ /g, "-"),
          name: p.name,
          slug: p.slug,
          category: p.category ?? "DeFi",
          tvl: getBaseTvl(p),
          tvlChange24h: p.change_1d ?? 0,
          tvlChange7d: p.change_7d ?? 0,
          logo: p.logo,
        }));

      await cache.set("baseforge:protocols", base20, 60);
      updatedKeys.push("protocols");

      streamTotalTvl = base20.reduce((s, p) => s + p.tvl, 0);
      streamProtocols = base20.map((p) => ({
        id: p.id,
        name: p.name,
        tvl: p.tvl,
        change24h: p.tvlChange24h,
        logo:
          p.logo ?? `https://icons.llama.fi/icons/protocols/${p.id}`,
        category: p.category,
      }));
    }
  } catch (err) {
    logger.warn("cache-warmer: protocols fetch failed", { error: String(err) });
  }

  try {
    const res = await fetch(
      "https://api.llama.fi/v2/historicalChainTvl/Base",
      { cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) {
      const raw: Array<{ date: number; tvl: number }> = await res.json();
      await cache.set("baseforge:tvl_history", raw, 300);
      updatedKeys.push("tvl_history");

      if (raw.length >= 2) {
        const latest = raw[raw.length - 1].tvl;
        const prev = raw[raw.length - 2].tvl;
        streamChange24h =
          prev > 0
            ? Math.round(((latest - prev) / prev) * 10000) / 100
            : 0;
      }
      streamTvlHistory = raw.slice(-60).map((d) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        tvl: d.tvl,
      }));
    }
  } catch (err) {
    logger.warn("cache-warmer: tvl history fetch failed", { error: String(err) });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${BASE_TOKEN_IDS}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const raw: Record<string, { usd: number; usd_24h_change?: number }> =
        await res.json();
      await cache.set("baseforge:prices", raw, 30);
      updatedKeys.push("prices");
      streamPrices = raw;
    }
  } catch (err) {
    logger.warn("cache-warmer: prices fetch failed", { error: String(err) });
  }

  let streamVersion: number | undefined;
  if (streamProtocols.length > 0) {
    const streamPayload = {
      analytics: {
        baseMetrics: {
          totalTvl: streamTotalTvl,
          totalProtocols: streamProtocols.length,
          avgApy: 0,
          change24h: streamChange24h,
        },
        tvlHistory: streamTvlHistory,
        protocols: streamProtocols,
        protocolData: {},
        timestamp: Date.now(),
      },
      prices: streamPrices,
      whales: [],
      timestamp: Date.now(),
      _source: "cron",
    };
    await cache.set("stream:latest", streamPayload, 120);
    updatedKeys.push("stream:latest");
    streamVersion = await incrementStreamVersion();
  }

  const latencyMs = Date.now() - t0;
  const ok = updatedKeys.length > 0;

  logger.info("cache-warmer complete", {
    ok,
    keys: updatedKeys,
    latencyMs,
    streamVersion,
  });

  return {
    ok,
    keys: updatedKeys,
    latencyMs,
    streamVersion,
    error: ok ? undefined : "no keys updated",
  };
}