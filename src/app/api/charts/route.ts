// src/app/api/charts/route.ts
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("charts", CACHE_TTL.TVL_HISTORY, async () => {
      // TVL history — the reliable DefiLlama endpoint
      const [tvlRes, feeRes, revRes] = await Promise.all([
        fetch("https://api.llama.fi/v2/historicalChainTvl/Base", { cache: "no-store" }),
        // Chain-level fees — using aggregated protocol fees for Base
        fetch("https://api.llama.fi/v2/fees?chain=base", { cache: "no-store" }),
        fetch("https://api.llama.fi/v2/fees?chain=base&aggregate=true", { cache: "no-store" }),
      ]);

      // TVL data
      const tvlHistory = tvlRes.ok ? await tvlRes.json() : [];
      const tvlData = tvlHistory.slice(-30).map((d: { date: number; tvl: number }) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tvl: d.tvl,
      }));

      // Fees from protocols on Base
      let feesData: { date: string; fees: number }[] = [];
      if (feeRes.ok) {
        const feeJson = await feeRes.json();
        if (feeJson.totalDataChart) {
          feesData = feeJson.totalDataChart
            .slice(-30)
            .map((item: [number, number]) => ({
              date: new Date(item[0] * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              fees: Math.round(item[1]),
            }));
        }
      }

      // Revenue
      let revenueData: { date: string; revenue: number }[] = [];
      if (revRes.ok) {
        const revJson = await revRes.json();
        if (revJson.totalDataChart) {
          revenueData = revJson.totalDataChart
            .slice(-30)
            .map((item: [number, number]) => ({
              date: new Date(item[0] * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              revenue: Math.round(item[1]),
            }));
        }
      }

      // Supply/Borrow estimate (40% utilization)
      const supplyBorrowData = tvlData.map((d: { date: string; tvl: number }) => ({
        date: d.date,
        supply: Math.round(d.tvl),
        borrow: Math.round(d.tvl * 0.4),
      }));

      return { tvlData, feesData, revenueData, supplyBorrowData };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Charts API error:", err);
    return NextResponse.json({ tvlData: [], feesData: [], revenueData: [], supplyBorrowData: [] });
  }
}

export const revalidate = 0;
