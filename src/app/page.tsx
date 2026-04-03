// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CandlestickChart,
  Fish,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Signal,
} from "lucide-react";
import OverviewSection from "@/components/sections/OverviewSection";
import MarketSection from "@/components/sections/MarketSection";
import WhalesSection from "@/components/sections/WhalesSection";
import RiskSection from "@/components/sections/RiskSection";
import ChartsSection from "@/components/sections/ChartsSection";
import { useRealTimeData } from "@/hooks/useRealTimeData";

interface AnalyticsData {
  baseMetrics?: {
    totalTvl: number;
    totalProtocols: number;
    avgApy: number;
    change24h: number;
  };
  tvlHistory?: { date: string; tvl: number }[];
  protocols?: Array<{ id: string; name: string; tvl: number; logo?: string }>;
  protocolData?: Record<string, any>;
}

type TabType = "overview" | "market" | "whales" | "risk" | "charts";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  ariaLabel: string;
}

const TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    ariaLabel: "Protocol overview",
  },
  {
    id: "market",
    label: "Market",
    icon: CandlestickChart,
    ariaLabel: "Market data",
  },
  {
    id: "whales",
    label: "Whales",
    icon: Fish,
    ariaLabel: "Whale tracker",
  },
  {
    id: "risk",
    label: "Risk",
    icon: ShieldAlert,
    ariaLabel: "Risk metrics",
  },
  {
    id: "charts",
    label: "Charts",
    icon: BarChart3,
    ariaLabel: "Analytics charts",
  },
];

export default function Home() {
  const [tab, setTab] = useState<TabType>("overview");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const { data: streamData, connectionState: streamState, isConnected } = useRealTimeData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // SSE auto-updates analytics from stream
  useEffect(() => {
    if (streamData?.analytics) {
      setAnalytics({
        baseMetrics: streamData.analytics.baseMetrics,
        tvlHistory: streamData.analytics.tvlHistory,
        protocols: streamData.analytics.protocols,
        protocolData: streamData.analytics.protocolData || {},
      });
    }
  }, [streamData?.analytics]);

  // Fetch analytics on mount (SSE is bonus, initial load is fetch)
  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then(setAnalytics)
      .catch(console.error);
  }, []);

  const isLoading = !isConnected && !analytics;

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetch("/api/analytics")
      .then(r => r.json())
      .then(d => setAnalytics(d))
      .finally(() => setIsRefreshing(false));
  };

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
  };

  const renderSection = () => {
    switch (tab) {
      case "market":
        return <MarketSection />;
      case "whales":
        return <WhalesSection />;
      case "risk":
        return <RiskSection />;
      case "charts":
        return (
          <ChartsSection
            data={
              analytics?.tvlHistory
                ? {
                    tvlData: analytics.tvlHistory.map(d => ({
                      date: d.date,
                      tvl: d.tvl,
                    })),
                    feesData: [],
                    revenueData: [],
                    supplyBorrowData: [],
                  }
                : null
            }
          />
        );
      default:
        return <OverviewSection data={analytics} isLoading={isLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-500 text-transparent bg-clip-text mb-2 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                BaseForge Analytics
              </h1>
              <p className="text-sm sm:text-base text-gray-400">
                Real-time DeFi analytics on{" "}
                <span className="text-emerald-400 font-semibold">Base</span>
              </p>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2.5 bg-gradient-to-br from-emerald-900/40 to-gray-800/40 hover:from-emerald-800/60 hover:to-emerald-900/60 border border-emerald-500/30 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCw
                className={`h-5 w-5 text-emerald-400 group-hover:text-emerald-300 transition-colors drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>

            {streamData && !isLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                <Signal className={`h-3 w-3 ${isConnected ? "text-emerald-400" : "text-yellow-400"}`} />
                <span>
                  SSE {isConnected ? "Live" : streamState} —
                  <span className="text-emerald-400/70 ml-1">
                    {streamData?.timestamp ? new Date(streamData.timestamp).toLocaleTimeString() : "connecting..."}
                  </span>
                </span>
              </div>
            )}
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 sm:p-6" role="main">
        {renderSection()}
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-emerald-500/20 shadow-[0_-5px_30px_rgba(16,185,129,0.1)] z-30"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex justify-around items-center py-2 px-2 max-w-screen-xl mx-auto">
          {TABS.map(({ id, label, icon: Icon, ariaLabel }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`
                flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl
                transition-all duration-300 min-w-[60px] sm:min-w-[70px]
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black
                ${
                  tab === id
                    ? "text-emerald-400 bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    : "text-gray-400 hover:text-emerald-300 hover:bg-gray-800/30"
                }
              `}
              aria-label={ariaLabel}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon
                size={20}
                className={`transition-all duration-300 ${
                  tab === id
                    ? "scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    : ""
                }`}
              />
              <span
                className={`text-[10px] sm:text-xs font-medium ${
                  tab === id
                    ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    : ""
                }`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
