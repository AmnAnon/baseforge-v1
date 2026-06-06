"use client";

import { useState } from "react";
import HubSubNav from "@/components/navigation/HubSubNav";
import OverviewSection from "@/components/sections/OverviewSection";
import ChartsSection from "@/components/sections/ChartsSection";
import type { AnalyticsData } from "@/app/HomeClient";

interface PulseHubProps {
  analytics: AnalyticsData | null;
  isLoading: boolean;
}

export default function PulseHub({ analytics, isLoading }: PulseHubProps) {
  const [sub, setSub] = useState("overview");

  const chartsData = analytics?.tvlHistory
    ? {
        tvlData: analytics.tvlHistory.map((d) => ({ date: d.date, tvl: d.tvl })),
        feesData: [] as { date: string; fees: number }[],
        revenueData: [] as { date: string; revenue: number }[],
        supplyBorrowData: [] as { date: string; supply: number; borrow: number }[],
      }
    : null;

  return (
    <div>
      <HubSubNav
        ariaLabel="Pulse sections"
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "charts", label: "Charts" },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "overview" ? (
        <OverviewSection data={analytics} isLoading={isLoading} />
      ) : (
        <ChartsSection data={chartsData} isLoading={isLoading} />
      )}
    </div>
  );
}