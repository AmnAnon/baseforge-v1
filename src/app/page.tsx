// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion"; // For animations (npm i framer-motion)
import {
  LayoutDashboard, CandlestickChart, Fish, ShieldAlert, BarChart3, RefreshCw, AlertCircle, ChevronDown
} from 'lucide-react';
import OverviewSection from "@/components/sections/OverviewSection";
import MarketSection from "@/components/sections/MarketSection";
import WhalesSection from "@/components/sections/WhalesSection";
import RiskSection from "@/components/sections/RiskSection";
import ChartsSection from "@/components/sections/ChartsSection";
import BaseTVLChart from "@/components/charts/BaseTVLChart";
import { AreaChart, Card } from "@tremor/react";

interface AnalyticsData {
  tvl: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  markets: any[];
  feesAnnualized: number;
  revenueAnnualized: number;
  seamPrice: number;
  seamFdv: number;
  tvlChange?: number;
  volume24h?: number;
  historicalData?: any[];
}

type TabType = "overview" | "market" | "whales" | "risk" | "charts";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  ariaLabel: string;
}

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, ariaLabel: "Protocol overview" },
  { id: "market", label: "Market", icon: CandlestickChart, ariaLabel: "Market data" },
  { id: "whales", label: "Whales", icon: Fish, ariaLabel: "Whale tracker" },
  { id: "risk", label: "Risk", icon: ShieldAlert, ariaLabel: "Risk metrics" },
  { id: "charts", label: "Charts", icon: BarChart3, ariaLabel: "Analytics charts" },
];

const PROTOCOLS = [ // Top 10 on Base by TVL
  { name: "Seamless", slug: "seamless-protocol" },
  { name: "Aerodrome", slug: "aerodrome" },
  { name: "Aave V3", slug: "aave-v3" },
  { name: "Morpho", slug: "morpho" },
  { name: "Extra Finance", slug: "extra-finance" },
  { name: "Moonwell", slug: "moonwell" },
  { name: "SushiSwap V3", slug: "sushiswap-v3" },
  { name: "Compound V3", slug: "compound-v3" },
  { name: "Balancer V2", slug: "balancer-v2" },
  { name: "Uniswap V3", slug: "uniswap-v3" },
];

export default function Home() {
  const [tab, setTab] = useState<TabType>("overview");
  const [currentProtocol, setCurrentProtocol] = useState(PROTOCOLS[0].slug);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const response = await fetch(`/api/analytics?protocol=${currentProtocol}`);
      if (!response.ok) throw new Error('Failed to fetch analytics data');
      const data = await response.json();
      setAnalytics(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, [currentProtocol]); 

  const handleManualRefresh = () => {
    if (!isRefreshing) loadData(true);
  };

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
  };

  const renderSection = () => {
    if (error && !analytics) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-400 mb-2">
                  Failed to Load Data
                </h3>
                <p className="text-sm text-gray-300 mb-4">{error}</p>
                <button
                  onClick={() => loadData(true)}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (tab) {
      case "market":
        return <MarketSection data={analytics} isLoading={isLoading} />;
      case "whales":
        return <WhalesSection />;
      case "risk":
        return <RiskSection data={analytics} isLoading={isLoading} />;
      case "charts":
        return <ChartsSection data={analytics} isLoading={isLoading} />;
      default:
        return <OverviewSection data={analytics} isLoading={isLoading} currentProtocol={currentProtocol} onProtocolChange={setCurrentProtocol} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white pb-24">
      {/* Header with neon accents */}
      <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-500 text-transparent bg-clip-text mb-2 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                BaseForge Analytics
              </h1>
              <p className="text-sm sm:text-base text-gray-400">
                Real-time DeFi analytics on <span className="text-emerald-400 font-semibold">Base</span>
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
                className={`h-5 w-5 text-emerald-400 group-hover:text-emerald-300 transition-colors drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {/* Last updated timestamp */}
          {lastUpdated && !isLoading && (
            <p className="text-xs text-gray-500 mt-3">
              Last updated: <span className="text-emerald-400/70">{lastUpdated.toLocaleTimeString()}</span>
            </p>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 sm:p-6" role="main">
      {renderSection()}
      </main>

      {/* Bottom navigation with neon effects */}
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
                ${tab === id
                  ? "text-emerald-400 bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  : "text-gray-400 hover:text-emerald-300 hover:bg-gray-800/30"
                }
              `}
              aria-label={ariaLabel}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon
                size={20}
                className={`transition-all duration-300 ${tab === id ? 'scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}`}
              />
              <span className={`text-[10px] sm:text-xs font-medium ${tab === id ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : ''}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
