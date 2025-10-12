import { NextResponse } from "next/server";
import { baseProtocolsService } from "@/app/services/baseProtocols.service";

export async function GET() {
  try {
    const analyticsData = await baseProtocolsService.getDashboardAnalytics();
    return NextResponse.json(analyticsData);
  } catch (err) {
    console.error("Analytics API route failed:", err);
    return NextResponse.json({ error: "Analytics fetch failed" }, { status: 500 });
  }
}

export const revalidate = 300; 

