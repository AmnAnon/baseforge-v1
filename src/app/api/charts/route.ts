import { NextResponse } from "next/server";
import { defiLlamaService } from "@/app/services/defillama.service";

interface TvlHistoryEntry {
  date: string;
  tvl: number;
}

interface ProtocolSummary {
  name: string;
  tvl: number;
  change1d: number;
  change7d: number;
}

interface ChartsResponse {
  tvlData: TvlHistoryEntry[];
  feesData: { date: string; fees: number }[];
  revenueData: { date: string; revenue: number }[];
  supplyBorrowData: { date: string; supply: number; borrow: number }[];
  protocol: ProtocolSummary | null;
}

export async function GET(req: Request): Promise<NextResponse<ChartsResponse | { error: string }>> {
  try {
    const url = new URL(req.url);
    const protocol = url.searchParams.get("protocol");

    const tvlHistory = await defiLlamaService.getBaseTVLHistory();

    let protocolData: ProtocolSummary | null = null;
    if (protocol) {
      const protocols = await defiLlamaService.getBaseProtocols();
      const matched = protocols.find(p => p.slug === protocol);
      if (matched) {
        protocolData = {
          name: matched.name,
          tvl: matched.chainTvls.Base || 0,
          change1d: matched.change_1d || 0,
          change7d: matched.change_7d || 0,
        };
      }
    }

    const feesResponse = await fetch(
      `https://api.llama.fi/overview/fees/base?dataType=dailyFee&excludeTotalDataChart=true`,
      { cache: "no-store" }
    );
    let feesData: { date: string; fees: number }[] = [];
    if (feesResponse.ok) {
      const feesJson = await feesResponse.json();
      if (feesJson.totalDataChart) {
        feesData = feesJson.totalDataChart
          .slice(-30)
          .map((item: [number, number]) => ({
            date: new Date(item[0] * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fees: Math.round(item[1]),
          }));
      }
    }

    const revenueResponse = await fetch(
      `https://api.llama.fi/overview/fees/base?dataType=dailyRevenue&excludeTotalDataChart=true`,
      { cache: "no-store" }
    );
    let revenueData: { date: string; revenue: number }[] = [];
    if (revenueResponse.ok) {
      const revJson = await revenueResponse.json();
      if (revJson.totalDataChart) {
        revenueData = revJson.totalDataChart
          .slice(-30)
          .map((item: [number, number]) => ({
            date: new Date(item[0] * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            revenue: Math.round(item[1]),
          }));
      }
    }

    const supplyBorrowEstimate = tvlHistory.slice(-30).map((item: { date: string; "Total Value Locked": number }) => ({
      date: item.date,
      supply: Math.round(item["Total Value Locked"]),
      borrow: Math.round(item["Total Value Locked"] * 0.4),
    }));

    const tvlData = tvlHistory.slice(-30).map((item: { date: string; "Total Value Locked": number }) => ({
      date: item.date,
      tvl: item["Total Value Locked"],
    }));

    return NextResponse.json({
      tvlData,
      feesData,
      revenueData,
      supplyBorrowData: supplyBorrowEstimate,
      protocol: protocolData,
    });
  } catch (error: unknown) {
    console.error("Charts API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

export const revalidate = 60;
