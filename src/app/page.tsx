// src/app/page.tsx
// Server Component — fetches initial analytics data at request time (ISR, revalidate 60s)
// so the page never SSR-renders with $0 / 0 protocols.
// All interactive/SSE logic lives in HomeClient.tsx.

import HomeClient, { type AnalyticsData } from "./HomeClient";

const EXCLUDED_CATEGORIES = new Set([
  "CEX", "Chain", "Bridge", "Liquidity Manager", "RWA",
]);

interface LlamaProtocol {
  slug?: string;
  name: string;
  category?: string;
  chainTvls?: Record<string, number>;
  change_1d?: number;
  logo?: string;
}

function getBaseTvl(p: LlamaProtocol): number {
  const tvls = p.chainTvls ?? {};
  const key = Object.keys(tvls).find((k) => k.toLowerCase() === "base");
  return key ? (tvls[key] ?? 0) : 0;
}

async function getInitialData(): Promise<AnalyticsData | null> {
  try {
    const [protRes, tvlRes] = await Promise.allSettled([
      fetch("https://api.llama.fi/protocols", {
        signal: AbortSignal.timeout(5_000),
        next: { revalidate: 60 },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch("https://api.llama.fi/v2/historicalChainTvl/Base", {
        signal: AbortSignal.timeout(5_000),
        next: { revalidate: 300 },
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const protocols: LlamaProtocol[] =
      protRes.status === "fulfilled" && Array.isArray(protRes.value) ? protRes.value : [];
    const tvlHistory: { date: number; tvl: number }[] =
      tvlRes.status === "fulfilled" && Array.isArray(tvlRes.value) ? tvlRes.value : [];

    if (protocols.length === 0 && tvlHistory.length === 0) return null;

    const baseProtocols = protocols
      .filter((p) => {
        const baseTvl = getBaseTvl(p);
        return baseTvl >= 100_000 && !EXCLUDED_CATEGORIES.has(p.category ?? "");
      })
      .sort((a, b) => getBaseTvl(b) - getBaseTvl(a))
      .slice(0, 20);

    const totalTvl = baseProtocols.reduce((s, p) => s + getBaseTvl(p), 0);

    const protocolList = baseProtocols.map((p) => ({
      id: p.slug ?? p.name.toLowerCase().replace(/\s+/g, "-"),
      name: p.name,
      tvl: getBaseTvl(p),
      change24h: p.change_1d ?? 0,
      category: p.category ?? "DeFi",
      logo: p.logo ?? "",
    }));

    let change24h = 0;
    if (tvlHistory.length >= 2) {
      const last = tvlHistory[tvlHistory.length - 1];
      const target = last.date - 86_400;
      let baseline = tvlHistory[0];
      for (const entry of tvlHistory) {
        if (entry.date <= target) baseline = entry;
        else break;
      }
      if (baseline.tvl > 0) {
        change24h = Math.round(((last.tvl - baseline.tvl) / baseline.tvl) * 10_000) / 100;
      }
    }

    return {
      baseMetrics: {
        totalTvl,
        totalProtocols: protocolList.length,
        avgApy: 0,
        change24h,
      },
      tvlHistory: tvlHistory.slice(-90).map((d) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tvl: d.tvl,
      })),
      protocols: protocolList,
      protocolData: {},
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const initialData = await getInitialData();
  return <HomeClient initialData={initialData} />;
}

export const revalidate = 60;
