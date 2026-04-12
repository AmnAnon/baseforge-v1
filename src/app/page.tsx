// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CandlestickChart,
  Fish,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  Signal,
  Wallet,
  Zap,
  GitCompare,
  Bell,
  DollarSign,
  Bot,
  TrendingUp,
} from "lucide-react";
import OverviewSection from "@/components/sections/OverviewSection";
import MarketSection from "@/components/sections/MarketSection";
import WhalesSection from "@/components/sections/WhalesSection";
import RiskSection from "@/components/sections/RiskSection";
import ChartsSection from "@/components/sections/ChartsSection";
import PortfolioSection from "@/components/sections/PortfolioSection";
import AlertsSection from "@/components/sections/AlertsSection";
import ProtocolCompareSection from "@/components/sections/ProtocolCompareSection";
import GasTrackerSection from "@/components/sections/GasTrackerSection";
import RevenueDashboard from "@/components/sections/RevenueDashboard";
import MEVSection from "@/components/sections/MEVSection";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { timeAgo, freshnessColor } from "@/lib/utils";
import AdminStatsBar from "@/components/AdminStatsBar";

interface AnalyticsData {
  baseMetrics?: {
    totalTvl: number;
    totalProtocols: number;
    avgApy: number;
    change24h: number;
  };
  tvlHistory?: { date: string; tvl: number }[];
  protocols?: Array<{ id: string; name: string; tvl: number; change24h?: number; category?: string; logo?: string }>;
  protocolData?: Record<string, { tvl: number; tvlChange: number; totalBorrow: number; utilization: number; feesAnnualized: number; revenueAnnualized: number; tokenPrice: number | null }>;
  timestamp?: number;
}

type TabType = "overview" | "market" | "portfolio" | "compare" | "alerts" | "revenue" | "mev" | "whales" | "risk" | "charts";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  ariaLabel: string;
}

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, ariaLabel: "Protocol overview" },
  { id: "market", label: "Market", icon: CandlestickChart, ariaLabel: "Market data" },
  { id: "portfolio", label: "Portfolio", icon: Wallet, ariaLabel: "Portfolio tracker" },
  { id: "revenue", label: "Revenue", icon: DollarSign, ariaLabel: "Protocol revenue" },
  { id: "mev", label: "MEV", icon: Bot, ariaLabel: "MEV activity" },
  { id: "compare", label: "Compare", icon: GitCompare, ariaLabel: "Protocol comparison" },
  { id: "alerts", label: "Alerts", icon: Bell, ariaLabel: "Active alerts" },
  { id: "whales", label: "Whales", icon: Fish, ariaLabel: "Whale tracker" },
  { id: "risk", label: "Risk", icon: ShieldAlert, ariaLabel: "Risk metrics" },
  { id: "charts", label: "Charts", icon: BarChart3, ariaLabel: "Analytics charts" },
];

export default function Home() {
  const [tab, setTab] = useState<TabType>("overview");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const { data: streamData, connectionState: streamState, isConnected, isFailed, reconnect, health } = useRealTimeData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (streamData?.analytics) {
      setAnalytics({
        baseMetrics: streamData.analytics.baseMetrics,
        tvlHistory: streamData.analytics.tvlHistory,
        protocols: streamData.analytics.protocols,
        protocolData: streamData.analytics.protocolData || {},
        timestamp: Date.now(),
      });
    }
  }, [streamData?.analytics]);

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then(d => setAnalytics({ ...d, timestamp: d.timestamp || Date.now() }))
      .catch(console.error);
  }, []);

  const isLoading = !isConnected && !analytics;

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetch("/api/analytics")
      .then(r => r.json())
      .then(d => setAnalytics({ ...d, timestamp: d.timestamp || Date.now() }))
      .finally(() => setIsRefreshing(false));
  };

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
  };

  const renderSection = () => {
    const fallback = (label: string) => (
      <ErrorBoundary
        fallback={
          <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20">
            <p className="text-red-400 font-semibold mb-2">
              {label} failed to load
            </p>
            <p className="text-xs text-gray-500 mb-4">
              This section encountered an error without affecting the rest of the dashboard.
            </p>
            <button
              onClick={() => setTab("overview")}
              className="px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors"
            >
              Go to Overview
            </button>
          </div>
        }
      >
        {null}
      </ErrorBoundary>
    );

    switch (tab) {
      case "market":
        return (
          <ErrorBoundary>
            <MarketSection />
          </ErrorBoundary>
        );
      case "whales":
        return (
          <ErrorBoundary>
            <WhalesSection />
          </ErrorBoundary>
        );
      case "risk":
        return (
          <ErrorBoundary>
            <RiskSection />
          </ErrorBoundary>
        );
      case "charts":
        return (
          <ErrorBoundary>
            <ChartsSection
              data={
                analytics?.tvlHistory
                  ? {
                      tvlData: analytics.tvlHistory.map(d => ({ date: d.date, tvl: d.tvl })),
                      feesData: [],
                      revenueData: [],
                      supplyBorrowData: [],
                    }
                  : null
              }
            />
          </ErrorBoundary>
        );
      case "portfolio":
        return (
          <ErrorBoundary>
            <PortfolioSection />
          </ErrorBoundary>
        );
      case "alerts":
        return (
          <ErrorBoundary>
            <AlertsSection />
          </ErrorBoundary>
        );
      case "compare":
        return (
          <ErrorBoundary>
            <ProtocolCompareSection />
          </ErrorBoundary>
        );
      case "revenue":
        return (
          <ErrorBoundary>
            <RevenueDashboard />
          </ErrorBoundary>
        );
      case "mev":
        return (
          <ErrorBoundary>
            <MEVSection />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary>
            <OverviewSection data={analytics} isLoading={isLoading} />
          </ErrorBoundary>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-500 text-transparent bg-clip-text mb-1 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                BaseForge Analytics
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs sm:text-base text-gray-400">
                  Real-time DeFi analytics on{" "}
                  <span className="text-emerald-400 font-semibold">Base</span>
                </p>
                <GasTrackerSection compact />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {analytics?.timestamp && (
                <div className={`text-xs ${freshnessColor(analytics.timestamp)} flex items-center gap-1`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {timeAgo(analytics.timestamp)}
                </div>
              )}

              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 bg-gradient-to-br from-emerald-900/40 to-gray-800/40 hover:from-emerald-800/60 hover:to-emerald-900/60 border border-emerald-500/30 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                aria-label="Refresh data"
              >
                <RefreshCw className={`h-5 w-5 text-emerald-400 transition-colors ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {streamData && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
              <Signal className={`h-3 w-3 ${isConnected ? "text-emerald-400" : isFailed ? "text-red-400" : "text-yellow-400"}`} />
              <span>
                SSE {isConnected ? "Live" : isFailed ? "Failed" : streamState}
                {isFailed && (
                  <button onClick={reconnect} className="ml-2 text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                    Reconnect
                  </button>
                )}
                {!isFailed && (
                  <span className="text-emerald-400/70 ml-1">
                    {streamData?.timestamp ? new Date(streamData.timestamp).toLocaleTimeString() : "connecting..."}
                  </span>
                )}
              </span>
              {health.attempts > 0 && !isConnected && (
                <span className="text-yellow-500/60">retry {health.attempts}</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="p-3 sm:p-6" role="main">
        {renderSection()}
      </main>

      {/* Admin frame analytics */}
      <AdminStatsBar />

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-emerald-500/20 shadow-[0_-5px_30px_rgba(16,185,129,0.1)] z-30"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex justify-around items-center py-1.5 px-1 max-w-screen-xl mx-auto">
          {TABS.map(({ id, label, icon: Icon, ariaLabel }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`
                flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl
                transition-all duration-300 min-w-[48px] max-w-[68px]
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
              <Icon size={18} className={`transition-all duration-300 ${tab === id ? "scale-110" : ""}`} />
              <span className={`text-[8px] sm:text-[10px] font-medium truncate ${tab === id ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" : ""}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
