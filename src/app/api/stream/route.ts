// src/app/api/stream/route.ts
// Server-Sent Events — real-time data push via Redis version-counter polling.
//
// Architecture (fan-out):
//   Worker  ──writes──▶  stream:latest (Redis)  ◀──reads── N SSE connections
//                         stream:version (incr)
//
// Each SSE connection polls only Redis (RTT ~1ms) every 2s.
// External API calls (DefiLlama, CoinGecko) happen once in the worker — not
// once per connected client — eliminating the N×30s polling fan-out.
//
// Fallback: if Redis is unavailable, assemble a live snapshot inline (old behavior)
// so the stream degrades gracefully rather than going silent.

import { Redis } from "@upstash/redis";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { cache, CACHE_TTL } from "@/lib/cache";

// ─── Redis singleton ──────────────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── SSE helper ──────────────────────────────────────────────────

const encoder = new TextEncoder();
function sse(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Inline fallback (legacy path, used when Redis is not configured) ──

const BASE = "https://api.llama.fi";

async function getFallbackSnapshot(): Promise<unknown> {
  return cache.getOrFetch("stream-fallback-v2", CACHE_TTL.TVL_HISTORY, async () => {
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
          logo:     p.logo ?? `https://icons.llamao.fi/icons/protocols/${p.slug ?? p.name.toLowerCase().replace(/ /g, "-")}`,
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

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 min — prevent serverless function exhaustion
const POLL_INTERVAL_MS = 2_000;        // Redis poll cadence per connection

export async function GET(request: Request) {
  const rateResponse = await rateLimiterMiddleware()(request);
  if (rateResponse) return rateResponse;

  const redis = getRedis();

  // ── Without Redis: fall back to inline polling (legacy behaviour) ──
  if (!redis) {
    let alive = true;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const snap = await getFallbackSnapshot();
          controller.enqueue(sse({ ...(snap as object), type: "snapshot" }));
        } catch {
          controller.enqueue(sse({ error: "Failed to initialize", type: "error" }));
          controller.close();
          return;
        }

        const iv = setInterval(async () => {
          if (!alive) return;
          try {
            const snap = await getFallbackSnapshot();
            controller.enqueue(sse({ ...(snap as object), type: "update" }));
          } catch { /* non-fatal */ }
        }, 30_000);

        const cleanup = setTimeout(() => { alive = false; try { controller.close(); } catch {} }, MAX_DURATION_MS);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (request as any).signal?.addEventListener("abort", () => { alive = false; clearInterval(iv); clearTimeout(cleanup); }, { once: true });
        // keep references so cancel() can clear them
        (controller as unknown as { _iv: unknown; _cleanup: unknown })._iv = iv;
        (controller as unknown as { _iv: unknown; _cleanup: unknown })._cleanup = cleanup;
      },
      cancel(controller) {
        alive = false;
        const c = controller as unknown as { _iv?: ReturnType<typeof setInterval>; _cleanup?: ReturnType<typeof setTimeout> };
        if (c._iv)      clearInterval(c._iv);
        if (c._cleanup) clearTimeout(c._cleanup);
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no", Connection: "keep-alive" },
    });
  }

  // ── With Redis: version-counter fan-out ──
  // Each connection polls only Redis (RTT ~1ms) — no upstream API calls per client.
  const stream = new ReadableStream({
    async start(controller) {
      let alive = true;
      let lastVersion = 0;

      // Send cached payload immediately so the client sees data before first poll fires
      try {
        const cached = await redis.get<unknown>("stream:latest");
        if (cached) {
          const payload = typeof cached === "string" ? JSON.parse(cached) : cached;
          controller.enqueue(sse({ ...(payload as object), type: "snapshot" }));

          const ver = await redis.get<string | number>("stream:version");
          if (ver !== null) lastVersion = Number(ver);
        } else {
          // No worker data yet — produce one inline snapshot so the client isn't blank
          const snap = await getFallbackSnapshot();
          controller.enqueue(sse({ ...(snap as object), type: "snapshot" }));
        }
      } catch (err) {
        console.error("[stream] initial send failed:", err);
        controller.enqueue(sse({ error: "Failed to initialize", type: "error" }));
        controller.close();
        return;
      }

      // Version-counter poll: only enqueue when worker has written new data
      const iv = setInterval(async () => {
        if (!alive) { clearInterval(iv); return; }
        try {
          const ver = await redis.get<string | number>("stream:version");
          if (ver === null) return;
          const vNum = Number(ver);
          if (vNum <= lastVersion) return; // nothing new
          lastVersion = vNum;

          const data = await redis.get<unknown>("stream:latest");
          if (!data) return;
          const payload = typeof data === "string" ? JSON.parse(data) : data;
          controller.enqueue(sse({ ...(payload as object), type: "update", _v: vNum }));
        } catch (err) {
          console.error("[stream] poll failed:", err);
        }
      }, POLL_INTERVAL_MS);

      // Hard cap to prevent serverless function exhaustion
      const cleanup = setTimeout(() => {
        alive = false;
        clearInterval(iv);
        try { controller.close(); } catch {}
      }, MAX_DURATION_MS);

      // Respect client disconnect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request as any).signal?.addEventListener("abort", () => {
        alive = false;
        clearInterval(iv);
        clearTimeout(cleanup);
      }, { once: true });
    },
    cancel() {
      // ReadableStream cancel — intervals already cleaned up via alive flag + clearInterval above
    },
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
