// src/app/api/stream/route.ts
// Server-Sent Events — real-time data push via Postgres version-counter polling.
//
// Architecture (fan-out):
//   Worker  ──writes──▶  stream:latest (api_cache)  ◀──reads── N SSE connections
//                         stream:version (counter)
//
// Each SSE connection polls only Postgres every 2s.
// External API calls (DefiLlama, CoinGecko) happen once in the worker — not
// once per connected client — eliminating the N×30s polling fan-out.

import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { cache, CACHE_TTL } from "@/lib/cache";
import { db } from "@/lib/db/client";
import { apiCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ─── SSE helper ──────────────────────────────────────────────────

const encoder = new TextEncoder();
function sse(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Inline fallback (legacy path, used if worker hasn't run yet) ──

const BASE = "https://api.llama.fi";

async function getFallbackSnapshot(): Promise<unknown> {
  return cache.getOrFetch("stream-fallback-v3", CACHE_TTL.TVL_HISTORY, async () => {
    const [protocolsRes, tvlRes] = await Promise.all([
      fetch(`${BASE}/protocols`, { cache: "no-store" }),
      fetch(`${BASE}/v2/historicalChainTvl/Base`, { cache: "no-store" }),
    ]);

    const protocols: Array<{
      name: string; slug?: string; logo?: string;
      chains?: string[]; chainTvls?: Record<string, number>;
      change_1d?: number; category?: string;
    }> = await protocolsRes.json();

    const tvlData: { date: number; tvl: number }[] = await tvlRes.json();

    const getBaseTvl = (p: { chainTvls?: Record<string, number> }): number =>
      p.chainTvls?.["Base"] ?? p.chainTvls?.["base"] ?? p.chainTvls?.["BASE"] ?? 0;

    const EXCLUDED = new Set(["CEX", "Chain"]);
    const baseProtos = protocols
      .filter((p) => p.chains?.includes("Base") === true && !EXCLUDED.has(p.category ?? ""))
      .sort((a, b) => getBaseTvl(b) - getBaseTvl(a))
      .slice(0, 20);

    const totalTvl = baseProtos.reduce((s, p) => s + getBaseTvl(p), 0);
    let change24h = 0;
    if (tvlData.length >= 2) {
      const latest = tvlData[tvlData.length - 1].tvl;
      const prev   = tvlData[tvlData.length - 2].tvl;
      change24h = prev > 0 ? Math.round(((latest - prev) / prev) * 10000) / 100 : 0;
    }

    return {
      analytics: {
        baseMetrics: { totalTvl, totalProtocols: baseProtos.length, avgApy: 0, change24h },
        tvlHistory: tvlData.slice(-60).map((d) => ({
          date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          tvl: d.tvl,
        })),
        protocols: baseProtos.map((p) => ({
          id:       p.slug ?? p.name.toLowerCase().replace(/ /g, "-"),
          name:     p.name,
          tvl:      getBaseTvl(p),
          change24h: p.change_1d ?? 0,
          logo:     p.logo ?? `https://icons.llama.fi/icons/protocols/${p.slug ?? p.name.toLowerCase().replace(/ /g, "-")}`,
          category: p.category ?? "",
        })),
        protocolData: {},
        timestamp: Date.now(),
      },
      prices:    {},
      whales:    [],
      timestamp: Date.now(),
      type:      "snapshot",
      _source:   "inline-fallback",
    };
  });
}

// ─── Route handler ────────────────────────────────────────────────

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 min
const POLL_INTERVAL_MS = 3000;         // Poll cadence

export async function GET(request: Request) {
  const rateResponse = await rateLimiterMiddleware()(request);
  if (rateResponse) return rateResponse;

  const stream = new ReadableStream({
    async start(controller) {
      let alive = true;
      let lastVersion = 0;

      // 1. Initial snapshot from Postgres or fallback
      try {
        const rows = await db.select().from(apiCache).where(eq(apiCache.key, "stream:latest")).limit(1);
        if (rows.length > 0) {
          controller.enqueue(sse({ ...((rows[0].value as any) || {}), type: "snapshot" }));
          
          const verRow = await db.select().from(apiCache).where(eq(apiCache.key, "stream:version")).limit(1);
          if (verRow.length > 0) lastVersion = parseInt(verRow[0].value as string, 10);
        } else {
          const snap = await getFallbackSnapshot();
          controller.enqueue(sse({ ...(snap as object), type: "snapshot" }));
        }
      } catch (err) {
        logger.error("[stream] init failed", { error: String(err) });
        controller.enqueue(sse({ error: "Initialization failed", type: "error" }));
        controller.close();
        return;
      }

      // 2. Polling loop
      const iv = setInterval(async () => {
        if (!alive) { clearInterval(iv); return; }
        try {
          const verRow = await db.select().from(apiCache).where(eq(apiCache.key, "stream:version")).limit(1);
          if (verRow.length === 0) return;
          const vNum = parseInt(verRow[0].value as string, 10);
          
          if (vNum <= lastVersion) return;
          lastVersion = vNum;

          const dataRow = await db.select().from(apiCache).where(eq(apiCache.key, "stream:latest")).limit(1);
          if (dataRow.length === 0) return;
          controller.enqueue(sse({ ...((dataRow[0].value as any) || {}), type: "update", _v: vNum }));
        } catch (err) {
          logger.error("[stream] poll failed", { error: String(err) });
        }
      }, POLL_INTERVAL_MS);

      const cleanup = setTimeout(() => {
        alive = false;
        clearInterval(iv);
        try { controller.close(); } catch {}
      }, MAX_DURATION_MS);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request as any).signal?.addEventListener("abort", () => {
        alive = false;
        clearInterval(iv);
        clearTimeout(cleanup);
      }, { once: true });
    },
    cancel() {
      // already handled by abort listener
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream",
      "Cache-Control":   "no-store",
      "X-Accel-Buffering": "no",
      Connection:        "keep-alive",
    },
  });
}
