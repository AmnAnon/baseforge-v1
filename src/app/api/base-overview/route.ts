// src/app/api/base-overview/route.ts
import { NextResponse } from "next/server";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
      const [tvlResponse, volumeResponse] = await Promise.all([
      fetch('https://api.llama.fi/v2/historicalChainTvl/Base'),
      fetch('https://api.llama.fi/overview/dexs/base?dataType=dailyVolume')
    ]);

    if (!tvlResponse.ok || !volumeResponse.ok) {
      throw new Error('Failed to fetch network data from DefiLlama');
    }

    const tvlData = await tvlResponse.json();
    const volumeData = await volumeResponse.json();

   const currentTvl = tvlData.length > 0 ? tvlData[tvlData.length - 1].tvl : 0;
    
   const totalVolume24h = volumeData.totalVolume;

    const baseMetrics = {
      totalTvl: currentTvl,
      totalVolume24h: totalVolume24h,
      };

    return NextResponse.json(baseMetrics);
  } catch (error) {
    console.error("Failed to fetch Base network overview:", error);
    return NextResponse.json({ error: "Failed to fetch network data" }, { status: 500 });
  }
}

export const revalidate = 300;
