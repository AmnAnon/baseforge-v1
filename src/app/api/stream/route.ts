// src/app/api/stream/route.ts
// Server-Sent Events — real-time data push
// Replaces 60s polling with live stream (30s intervals)

import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

const encoder = new TextEncoder();
const BASE = "https://api.llama.fi";

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function getAnalytics() {
  return cache.getOrFetch("stream-analytics", CACHE_TTL.TVL_HISTORY, async () => {
    const [protocolsRes, tvlRes] = await Promise.all([
      fetch(`${BASE}/protocols`, { cache: "no-store" }),
      fetch(`${BASE}/v2/historicalChainTvl/Base`, { cache: "no-store" }),
    ]);

    const protocols = await protocolsRes.json();
    const tvlData: { date: number; tvl: number }[] = await tvlRes.json();

    // Case-insensitive Base TVL helper
    const getBaseTvl = (p: { chainTvls?: Record<string, number> }): number =>
      p.chainTvls?.["Base"] ?? p.chainTvls?.["base"] ?? p.chainTvls?.["BASE"] ?? 0;

    const STREAM_EXCLUDED = new Set(["CEX", "Chain"]);
    const baseProtos = protocols
      .filter((p: { chains?: string[]; chainTvls?: Record<string, number>; category?: string }) =>
        p.chains?.includes("Base") === true &&
        !STREAM_EXCLUDED.has(p.category || "")
      )
      .sort((a: { chainTvls?: Record<string, number> }, b: { chainTvls?: Record<string, number> }) =>
        getBaseTvl(b) - getBaseTvl(a)
      )
      .slice(0, 20);
    const totalTvl = baseProtos.reduce(
      (sum: number, p: { chainTvls?: Record<string, number> }) => sum + getBaseTvl(p), 0
    );

    // Compute real 24h TVL change from historical data
    let change24h = 0;
    if (tvlData.length >= 2) {
      const latest = tvlData[tvlData.length - 1].tvl;
      const prev = tvlData[tvlData.length - 2].tvl;
      change24h = prev > 0 ? Math.round(((latest - prev) / prev) * 10000) / 100 : 0;
    }

    return {
      baseMetrics: { totalTvl, totalProtocols: baseProtos.length, avgApy: 0, change24h },
      tvlHistory: tvlData.slice(-60).map((d: { date: number; tvl: number }) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tvl: d.tvl,
      })),
      protocols: baseProtos.map((p: { name: string; slug?: string; logo?: string; chainTvls?: Record<string, number>; change_1d?: number; category?: string }) => ({
        id: p.slug || p.name.toLowerCase().replace(/ /g, "-"),
        name: p.name,
        tvl: getBaseTvl(p),
        change24h: p.change_1d || 0,
        logo: p.logo || `https://icons.llamao.fi/icons/protocols/${(p.slug || p.name.toLowerCase().replace(/ /g, "-"))}`,
        category: p.category || "",
      })),
      protocolData: {},
      timestamp: Date.now(),
    };
  });
}

async function getPrices() {
  return cache.getOrFetch("stream-prices", CACHE_TTL.PRICES, async () => {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    return await res.json();
  });
}

async function getWhales() {
  return cache.getOrFetch("stream-whales", CACHE_TTL.WHALE_TX, async () => {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) return [];
    try {
      const res = await fetch(
        `https://api.etherscan.io/v2/api?chainid=8453&module=account&action=txlist&address=0x4200000000000000000000000000000000000006&startblock=0&endblock=99999999&page=1&offset=5&sort=desc&apikey=${apiKey}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.status !== "1") return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.result.slice(0, 5).map((tx: any) => ({
        hash: tx.hash, from: tx.from.slice(0, 6) + "..." + tx.from.slice(-4),
        to: tx.to.slice(0, 6) + "..." + tx.to.slice(-4), value: tx.value,
        valueUSD: (parseFloat(tx.value) / 1e18) * 1800, type: "transfer", token: "WETH",
      }));
    } catch { return []; }
  });
}

export async function GET(request: Request) {
  const rateResponse = await rateLimiterMiddleware()(request);
  if (rateResponse) return rateResponse;

  let alive = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
  const MAX_DURATION = 5 * 60 * 1000; // 5 minutes max

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const [analytics, prices, whales] = await Promise.all([getAnalytics(), getPrices(), getWhales()]);
        controller.enqueue(encoder.encode(sse({ analytics, prices, whales: whales.slice(0, 3), timestamp: Date.now(), type: "snapshot" })));
      } catch (err) {
        console.error("Stream snapshot failed:", err);
        controller.enqueue(encoder.encode(sse({ msg: "Failed to initialize" })));
        alive = false;
        controller.close();
        return;
      }

      intervalId = setInterval(async () => {
        if (!alive) return;
        try {
          const [analytics, prices, whales] = await Promise.all([getAnalytics(), getPrices(), getWhales()]);
          controller.enqueue(encoder.encode(sse({ analytics, prices, whales: whales.slice(0, 3), timestamp: Date.now(), type: "update" })));
        } catch (err) {
          console.error("Stream update failed:", err);
        }
      }, 30000);

      // Auto-cleanup after max duration to prevent resource exhaustion on serverless
      cleanupTimeout = setTimeout(() => {
        console.log("SSE connection timed out (max duration reached)");
        alive = false;
        try { controller.close(); } catch {}
      }, MAX_DURATION);

      // Also respect client disconnect (AbortSignal)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signal = (request as any).signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          alive = false;
          if (intervalId) clearInterval(intervalId);
          if (cleanupTimeout) clearTimeout(cleanupTimeout);
        }, { once: true });
      }
    },
    cancel() {
      alive = false;
      if (intervalId) clearInterval(intervalId);
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
