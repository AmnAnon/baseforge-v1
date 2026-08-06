"use client";

// src/app/HomeClient.tsx
// Interactive client shell for the home page.
// Receives initialData from the Server Component (page.tsx) to avoid SSR zeros.

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRightLeft,
  Activity,
  Fish,
  ShieldAlert,
  Rocket,
  RefreshCw,
  Signal,
  Wallet,
  Zap,
  TrendingUp,
  Terminal,
  Monitor,
  Cpu,
  MoreHorizontal,
} from "lucide-react";
import PulseHub from "@/components/hubs/PulseHub";
import RiskHub from "@/components/hubs/RiskHub";
import FlowsHub from "@/components/hubs/FlowsHub";
import MarketHub from "@/components/hubs/MarketHub";
import SwapHub from "@/components/hubs/SwapHub";
import MemecoinRadarHub from "@/components/hubs/MemecoinRadarHub";
import SmartMoneyHub from "@/components/hubs/SmartMoneyHub";
import DeveloperHub from "@/components/hubs/DeveloperHub";
import PortfolioSection from "@/components/sections/PortfolioSection";
import WalletConnectButton from "@/components/ui/WalletConnectButton";
import SwapModal from "@/components/ui/SwapModal";
import { NeonCard } from "@/components/ui/NeonCard";
import { CountUp } from "@/components/ui/CountUp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { timeAgo, freshnessColor } from "@/lib/utils";
import AdminStatsBar from "@/components/AdminStatsBar";
import Logo from "@/components/ui/Logo";

export interface AnalyticsData {
  baseMetrics?: { totalTvl: number; totalProtocols: number; avgApy: number; change24h: number };
  tvlHistory?: { date: string; tvl: number }[];
  protocols?: Array<{ id: string; name: string; tvl: number; change24h?: number; category?: string; logo?: string }>;
  protocolData?: Record<string, { tvl: number; tvlChange: number; totalBorrow: number; utilization: number; feesAnnualized: number; revenueAnnualized: number; tokenPrice: number | null }>;
  timestamp?: number;
}

type HubId = "pulse" | "risk" | "flows" | "launches" | "signals" | "swap" | "portfolio" | "dev" | "more";

interface HubConfig {
  id: HubId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  ariaLabel: string;
}

const HUBS: HubConfig[] = [
  { id: "pulse", label: "Pulse", icon: Activity, ariaLabel: "Ecosystem pulse — overview and charts" },
  { id: "risk", label: "Risk", icon: ShieldAlert, ariaLabel: "Risk scores, compare, and alerts" },
  { id: "flows", label: "Flows", icon: Fish, ariaLabel: "Whale and MEV flows" },
  { id: "launches", label: "Radar", icon: Rocket, ariaLabel: "Base Memecoin & Token Launch Radar" },
  { id: "signals", label: "Alpha", icon: TrendingUp, ariaLabel: "Smart Money & Copy-Trading Signals" },
  { id: "swap", label: "Swap", icon: ArrowRightLeft, ariaLabel: "1-Click Base DEX Swap" },
  { id: "dev", label: "Build", icon: Terminal, ariaLabel: "Developer SDK & Action API" },
  { id: "portfolio", label: "Portfolio", icon: Wallet, ariaLabel: "Wallet portfolio" },
  { id: "more", label: "More", icon: MoreHorizontal, ariaLabel: "Market data and developer tools" },
];

const HUB_STORAGE_KEY = "baseforge-hub";

function readStoredHub(): HubId {
  if (typeof window === "undefined") return "pulse";
  const stored = localStorage.getItem(HUB_STORAGE_KEY);
  if (stored && HUBS.some((h) => h.id === stored)) return stored as HubId;
  return "pulse";
}

function formatGas(gwei?: number): string {
  if (!gwei || gwei <= 0) return "0.001";
  return gwei.toFixed(3);
}

export default function HomeClient({ initialData }: { initialData: AnalyticsData | null }) {
  const [hub, setHub] = useState<HubId>("pulse");

  useEffect(() => {
    setHub(readStoredHub());
  }, []);

  const selectHub = useCallback((id: HubId) => {
    setHub(id);
    localStorage.setItem(HUB_STORAGE_KEY, id);
  }, []);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(initialData);
  const [gasGwei, setGasGwei] = useState(0.001);
  const [scanlines, setScanlines] = useState(false);
  const { data: streamData, connectionState: streamState, isConnected, isFailed, reconnect, health } = useRealTimeData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

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

  // Refresh analytics from REST API on mount (updates initialData with live values)
  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setAnalytics({ ...d, timestamp: d.timestamp || Date.now() }))
      .catch(console.error);
  }, []);

  const isLoading = !analytics;

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setAnalytics({ ...d, timestamp: d.timestamp || Date.now() }))
      .finally(() => setIsRefreshing(false));
  }, []);

  const renderHub = () => {
    switch (hub) {
      case "risk":
        return <ErrorBoundary><RiskHub /></ErrorBoundary>;
      case "flows":
        return <ErrorBoundary><FlowsHub /></ErrorBoundary>;
      case "launches":
        return <ErrorBoundary><MemecoinRadarHub /></ErrorBoundary>;
      case "signals":
        return <ErrorBoundary><SmartMoneyHub /></ErrorBoundary>;
      case "swap":
        return <ErrorBoundary><SwapHub /></ErrorBoundary>;
      case "dev":
        return <ErrorBoundary><DeveloperHub /></ErrorBoundary>;
      case "portfolio":
        return <ErrorBoundary><PortfolioSection /></ErrorBoundary>;
      case "more":
        return <ErrorBoundary><MarketHub /></ErrorBoundary>;
      default:
        return (
          <ErrorBoundary>
            <PulseHub analytics={analytics} isLoading={isLoading} />
          </ErrorBoundary>
        );
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
          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3 mb-1">
                <Logo size={36} className="sm:hidden" />
                <Logo size={44} className="hidden sm:block" />
                <h1 className="text-xl sm:text-3xl font-bold gradient-text">
                  BaseForge
                </h1>
              </div>
              <p className="text-xs sm:text-base text-[var(--bf-text-secondary)]">
                AI-ready intelligence layer for{" "}
                <span className="neon-text font-semibold">Base</span>
                {" "}— live risk, flows, and{" "}
                <a
                  href="/api/agents/context?include=all&top=5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--bf-neon-accent)] hover:text-[var(--bf-neon-primary)] underline underline-offset-2"
                >
                  agent context
                </a>
              </p>
            </div>

            {/* Header Action Bar: Wallet Connect + 1-Click Swap + Refresh + CRT */}
            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
              {analytics?.timestamp && (
                <div className={`hidden md:flex text-xs ${freshnessColor(analytics.timestamp)} items-center gap-1`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {timeAgo(analytics.timestamp)}
                </div>
              )}
              <button
                onClick={() => setIsSwapModalOpen(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-[#00d4ff]/20 to-[#7b61ff]/20 hover:from-[#00d4ff]/30 hover:to-[#7b61ff]/30 border border-[#00d4ff]/40 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,212,255,0.15)]"
                title="1-Click DEX Swap"
              >
                <Zap size={14} className="text-amber-400 fill-amber-400 animate-pulse" />
                <span>⚡ 1-Click Swap</span>
              </button>
              <WalletConnectButton />
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
                    <CountUp value={tvl} prefix="$" compact />
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
        {renderHub()}

        {/* Global footer */}
        <footer className="mt-8 mb-2 text-center">
          <p className="text-[10px] text-[var(--bf-text-muted)]">
            Data from Envio HyperSync + DefiLlama + CoinGecko · Beta · Real-time via SSE
          </p>
        </footer>
      </main>

      {/* Admin frame analytics — shown in demo or when explicitly enabled (no secrets leaked to client) */}
      {(process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_SHOW_ADMIN_BAR === "true") && <AdminStatsBar />}

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[var(--bf-neon-primary)]/20 shadow-[0_-5px_30px_rgba(0,212,255,0.1)] z-30"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex justify-between items-center py-2 px-2 sm:px-4 max-w-screen-xl mx-auto gap-1">
          {HUBS.map(({ id, label, icon: Icon, ariaLabel }) => (
            <button
              key={id}
              onClick={() => selectHub(id)}
              className={`
                flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl
                transition-all duration-300 max-w-[80px]
                focus:outline-none focus:ring-2 focus:ring-[var(--bf-neon-primary)] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]
                ${
                  hub === id
                    ? "text-[var(--bf-neon-primary)] bg-[#00d4ff]/10 shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                    : "text-[var(--bf-text-secondary)] hover:text-[var(--bf-neon-primary)] hover:bg-white/5"
                }
              `}
              aria-label={ariaLabel}
              aria-current={hub === id ? "page" : undefined}
            >
              <Icon size={20} className={`transition-all duration-300 ${hub === id ? "scale-110" : ""}`} />
              <span className={`text-[10px] sm:text-xs font-medium ${hub === id ? "neon-text" : ""}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* 1-Click Swap Popup Modal */}
      <SwapModal isOpen={isSwapModalOpen} onClose={() => setIsSwapModalOpen(false)} />
    </div>
  );
}
