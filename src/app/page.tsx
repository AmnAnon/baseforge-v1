// src/app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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
  Monitor,
  Activity,
  Cpu,
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
import { NeonCard } from "@/components/ui/NeonCard";
import { CountUp } from "@/components/ui/CountUp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { timeAgo, freshnessColor } from "@/lib/utils";
import AdminStatsBar from "@/components/AdminStatsBar";

interface AnalyticsData {
  baseMetrics?: { totalTvl: number; totalProtocols: number; avgApy: number; change24h: number };
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

function formatTVL(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function formatGas(gwei?: number): string {
  if (!gwei || gwei <= 0) return "0.001";
  return gwei.toFixed(3);
}

export default function Home() {
  const [tab, setTab] = useState<TabType>("overview");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [gasGwei, setGasGwei] = useState(0.001);
  const [scanlines, setScanlines] = useState(false);
  const { data: streamData, connectionState: streamState, isConnected, isFailed, reconnect, health } = useRealTimeData();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // CRT toggle via keyboard shortcut (Ctrl+Shift+S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setScanlines((s) => {
          const next = !s;
          document.getElementById("scanlines")?.classList.toggle("active", next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch gas price
  useEffect(() => {
    fetch("/api/gas")
      .then((r) => r.json())
      .then((d) => setGasGwei(d.l2BaseFeeGwei ?? 0.001))
      .catch(() => {});
    const interval = setInterval(() => {
      fetch("/api/gas")
        .then((r) => r.json())
        .then((d) => setGasGwei(d.l2BaseFeeGwei ?? 0.001))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync stream data → analytics state
  const streamAnalytics = streamData?.analytics;
  useEffect(() => {
    if (!streamAnalytics) return;
    const next = {
      baseMetrics: streamAnalytics.baseMetrics,
      tvlHistory: streamAnalytics.tvlHistory,
      protocols: streamAnalytics.protocols,
      protocolData: streamAnalytics.protocolData || {},
      timestamp: Date.now(),
    };
    setAnalytics(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamAnalytics]);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setAnalytics({ ...d, timestamp: d.timestamp || Date.now() }))
      .catch(console.error);
  }, []);

  const isLoading = !isConnected && !analytics;

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setAnalytics({ ...d, timestamp: d.timestamp || Date.now() }))
      .finally(() => setIsRefreshing(false));
  }, []);

  const renderSection = () => {
    switch (tab) {
      case "market":
        return <ErrorBoundary><MarketSection /></ErrorBoundary>;
      case "whales":
        return <ErrorBoundary><WhalesSection /></ErrorBoundary>;
      case "risk":
        return <ErrorBoundary><RiskSection /></ErrorBoundary>;
      case "charts":
        return (
          <ErrorBoundary>
            <ChartsSection
              data={
                analytics?.tvlHistory
                  ? {
                      tvlData: analytics.tvlHistory.map((d) => ({ date: d.date, tvl: d.tvl })),
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
        return <ErrorBoundary><PortfolioSection /></ErrorBoundary>;
      case "alerts":
        return <ErrorBoundary><AlertsSection /></ErrorBoundary>;
      case "compare":
        return <ErrorBoundary><ProtocolCompareSection /></ErrorBoundary>;
      case "revenue":
        return <ErrorBoundary><RevenueDashboard /></ErrorBoundary>;
      case "mev":
        return <ErrorBoundary><MEVSection /></ErrorBoundary>;
      default:
        return <ErrorBoundary><OverviewSection data={analytics} isLoading={isLoading} /></ErrorBoundary>;
    }
  };

  const tvl = analytics?.baseMetrics?.totalTvl ?? 0;
  const protocols = analytics?.baseMetrics?.totalProtocols ?? 0;
  const change24h = analytics?.baseMetrics?.change24h ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-[#00d4ff]/20 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <div className="p-3 sm:p-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold gradient-text mb-1">
                BaseForge Analytics
              </h1>
              <p className="text-xs sm:text-base text-[var(--bf-text-secondary)]">
                Real-time DeFi intelligence on{" "}
                <span className="neon-text font-semibold">Base</span>
              </p>
            </div>

            {/* Refresh + CRT toggle */}
            <div className="flex items-center gap-2">
              {analytics?.timestamp && (
                <div className={`text-xs ${freshnessColor(analytics.timestamp)} flex items-center gap-1`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {timeAgo(analytics.timestamp)}
                </div>
              )}
              <button
                onClick={() => setScanlines((s) => {
                  const n = !s;
                  document.getElementById("scanlines")?.classList.toggle("active", n);
                  return n;
                })}
                className="p-2 bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl transition-all text-[var(--bf-text-muted)] hover:text-[var(--bf-neon-primary)]"
                aria-label="Toggle CRT scanlines"
                title="Ctrl+Shift+S"
              >
                <Monitor size={16} />
              </button>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 bg-black/40 hover:bg-black/60 border border-[var(--bf-neon-primary)]/30 rounded-xl transition-all text-[var(--bf-neon-primary)] disabled:opacity-50"
                aria-label="Refresh data"
              >
                <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Live ticker */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <NeonCard glowColor="rgba(0,212,255,0.08)" className="!p-2 !rounded-xl flex-1 min-w-[140px]" hoverScale={1}>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[var(--bf-neon-primary)]" />
                <div>
                  <div className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider">Total TVL</div>
                  <div className="text-sm font-mono font-semibold neon-text">
                    <CountUp value={tvl} prefix="$" />
                  </div>
                </div>
              </div>
            </NeonCard>

            <NeonCard glowColor="rgba(123,97,255,0.08)" className="!p-2 !rounded-xl flex-1 min-w-[100px]" hoverScale={1}>
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-[var(--bf-neon-accent)]" />
                <div>
                  <div className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider">Protocols</div>
                  <div className="text-sm font-mono font-semibold" style={{ color: "var(--bf-neon-accent)" }}>
                    <CountUp value={protocols} />
                  </div>
                </div>
              </div>
            </NeonCard>

            <NeonCard glowColor={change24h >= 0 ? "rgba(0,255,136,0.08)" : "rgba(255,45,123,0.08)"} className="!p-2 !rounded-xl flex-1 min-w-[100px]" hoverScale={1}>
              <div className="flex items-center gap-2">
                <Activity size={14} className={change24h >= 0 ? "text-[var(--bf-status-ok)]" : "text-[var(--bf-status-danger)]"} />
                <div>
                  <div className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider">24h Change</div>
                  <div className={`text-sm font-mono font-semibold ${change24h >= 0 ? "status-ok" : "status-danger"}`}>
                    {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                  </div>
                </div>
              </div>
            </NeonCard>

            <NeonCard glowColor="rgba(0,255,136,0.08)" className="!p-2 !rounded-xl flex-1 min-w-[100px]" hoverScale={1}>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[var(--bf-status-ok)]" />
                <div>
                  <div className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider">Gas</div>
                  <div className="text-sm font-mono font-semibold status-ok">
                    {formatGas(gasGwei)} gwei
                  </div>
                </div>
              </div>
            </NeonCard>
          </div>

          {/* SSE status */}
          {streamData && !isLoading && (
            <div className="flex items-center gap-2 text-xs text-[var(--bf-text-muted)] mt-2">
              <Signal className={`h-3 w-3 ${isConnected ? "text-[var(--bf-status-ok)]" : isFailed ? "text-[var(--bf-status-danger)]" : "text-[var(--bf-status-warn)]"}`} />
              <span>
                SSE {isConnected ? "Live" : isFailed ? "Failed" : streamState}
                {isFailed && (
                  <button onClick={reconnect} className="ml-2 text-[var(--bf-neon-primary)] hover:text-[var(--bf-neon-secondary)] underline underline-offset-2">
                    Reconnect
                  </button>
                )}
                {!isFailed && (
                  <span className="text-[var(--bf-neon-primary)]/70 ml-1">
                    {streamData?.timestamp ? new Date(streamData.timestamp).toLocaleTimeString() : "connecting..."}
                  </span>
                )}
              </span>
              {health.attempts > 0 && !isConnected && (
                <span className="text-[var(--bf-status-warn)]/60">retry {health.attempts}</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="p-3 sm:p-6" role="main">
        {renderSection()}

        {/* Global footer */}
        <footer className="mt-8 mb-2 text-center">
          <p className="text-[10px] text-[var(--bf-text-muted)]">
            Data from Envio HyperSync + DefiLlama + CoinGecko · Beta · Real-time via SSE
          </p>
        </footer>
      </main>

      {/* Admin frame analytics — dev only */}
      {process.env.NEXT_PUBLIC_ADMIN_KEY && <AdminStatsBar />}

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[var(--bf-neon-primary)]/20 shadow-[0_-5px_30px_rgba(0,212,255,0.1)] z-30"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex justify-around items-center py-1.5 px-1 max-w-screen-xl mx-auto">
          {TABS.map(({ id, label, icon: Icon, ariaLabel }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`
                flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-xl
                transition-all duration-300 min-w-[48px] max-w-[68px]
                focus:outline-none focus:ring-2 focus:ring-[var(--bf-neon-primary)] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]
                ${
                  tab === id
                    ? "text-[var(--bf-neon-primary)] bg-[#00d4ff]/10 shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                    : "text-[var(--bf-text-secondary)] hover:text-[var(--bf-neon-primary)] hover:bg-white/5"
                }
              `}
              aria-label={ariaLabel}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={18} className={`transition-all duration-300 ${tab === id ? "scale-110" : ""}`} />
              <span className={`text-[8px] sm:text-[10px] font-medium truncate ${tab === id ? "neon-text" : ""}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
