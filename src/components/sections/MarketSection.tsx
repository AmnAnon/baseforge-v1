// src/components/sections/MarketSection.tsx
"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { MetricSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";

// ─── Types ──────────────────────────────────────────────────────

interface TokenData {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

interface MarketSummary {
  totalTokens: number;
  avgChange24h: number;
  totalVolume24h: number;
}

interface ApiResponse {
  tokens: TokenData[];
  topGainers: TokenData[];
  topLosers: TokenData[];
  topByVolume: TokenData[];
  summary: MarketSummary;
  timestamp: number;
  isStale?: boolean;
}

// ─── Formatters ─────────────────────────────────────────────────

function formatPrice(value: number): string {
  if (value >= 10_000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toExponential(2)}`;
}

function formatCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ─── Token Row ──────────────────────────────────────────────────

function TokenRow({ token, rank }: { token: TokenData; rank: number }) {
  const isUp = token.change24h >= 0;

  return (
    <tr className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
      {/* Rank */}
      <td className="py-3 px-2 text-center">
        <span className="text-xs text-gray-500 tabular-nums">{rank}</span>
      </td>

      {/* Token (logo + name + symbol) */}
      <td className="py-3 px-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={token.logo}
            alt={token.symbol}
            width={28}
            height={28}
            className="rounded-full flex-shrink-0 bg-gray-800"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate leading-tight">
              {token.name}
            </p>
            <p className="text-xs text-gray-500 leading-tight">{token.symbol}</p>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="py-3 px-2 text-right">
        <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap">
          {formatPrice(token.price)}
        </span>
      </td>

      {/* 24h Change */}
      <td className="py-3 px-2 text-right">
        <div className={`inline-flex items-center gap-0.5 text-sm font-medium tabular-nums whitespace-nowrap ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {isUp ? <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" /> : <ArrowDownRight className="h-3.5 w-3.5 flex-shrink-0" />}
          {formatPct(token.change24h)}
        </div>
      </td>

      {/* Volume (hidden on small screens) */}
      <td className="py-3 px-2 text-right hidden sm:table-cell">
        <span className="text-sm text-gray-400 tabular-nums whitespace-nowrap">
          {formatCompact(token.volume24h)}
        </span>
      </td>

      {/* Market Cap (hidden on small screens) */}
      <td className="py-3 px-2 text-right hidden md:table-cell">
        <span className="text-sm text-gray-300 tabular-nums whitespace-nowrap">
          {formatCompact(token.marketCap)}
        </span>
      </td>
    </tr>
  );
}

// ─── Tab Config ─────────────────────────────────────────────────

type TabId = "all" | "gainers" | "losers" | "volume";

const TABS: { id: TabId; label: string; shortLabel: string; icon: typeof BarChart3 }[] = [
  { id: "all", label: "All Tokens", shortLabel: "All", icon: BarChart3 },
  { id: "gainers", label: "Top Gainers", shortLabel: "Gainers", icon: TrendingUp },
  { id: "losers", label: "Top Losers", shortLabel: "Losers", icon: TrendingDown },
  { id: "volume", label: "By Volume", shortLabel: "Volume", icon: DollarSign },
];

// ─── Main Component ─────────────────────────────────────────────

export default function MarketSection({
  data,
  isLoading: parentLoading,
}: {
  data?: ApiResponse | null;
  isLoading?: boolean;
}) {
  const [marketData, setMarketData] = useState<ApiResponse | null>(data ?? null);
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");

  const fetchData = () => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch("/api/market")
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) setMarketData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market")
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) { setMarketData(d); setIsLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // ── Error state ──

  if (error && !marketData) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Market Overview</h2>
        <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20">
          <AlertCircle className="h-6 w-6 text-red-400 mb-3" />
          <p className="text-red-400 font-medium mb-1">Market data unavailable</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const loading = isLoading || parentLoading;

  // ── Get display tokens based on active tab ──

  const getDisplayTokens = (): TokenData[] => {
    if (!marketData) return [];
    switch (tab) {
      case "gainers": return marketData.topGainers;
      case "losers": return marketData.topLosers;
      case "volume": return marketData.topByVolume;
      default: return marketData.tokens;
    }
  };

  const displayTokens = getDisplayTokens();

  return (
    <section className="space-y-5" aria-labelledby="market-heading">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="market-heading" className="text-2xl sm:text-3xl font-bold text-white">
            Market Overview
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Base ecosystem tokens — real-time prices
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="p-2 bg-emerald-900/30 border border-emerald-500/20 rounded-xl hover:bg-emerald-800/50 transition-colors disabled:opacity-50 flex-shrink-0"
          aria-label="Refresh market data"
        >
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary Cards */}
      {loading && !marketData ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <MetricSkeleton />
            </div>
          ))}
        </div>
      ) : marketData?.summary ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-gray-500" />
              <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Tokens</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white tabular-nums">{marketData.summary.totalTokens}</p>
          </div>
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              {marketData.summary.avgChange24h >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
              <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Avg 24h</p>
            </div>
            <p className={`text-lg sm:text-2xl font-bold tabular-nums ${marketData.summary.avgChange24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatPct(marketData.summary.avgChange24h)}
            </p>
          </div>
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-gray-500" />
              <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">24h Vol</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-white tabular-nums">{formatCompact(marketData.summary.totalVolume24h)}</p>
          </div>
        </div>
      ) : null}

      {/* Tab Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === id
                ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30"
                : "text-gray-400 hover:text-emerald-300 hover:bg-gray-800/30"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Token Table */}
      {loading && !marketData ? (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TableRowSkeleton key={i} cols={5} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2.5 px-2 text-center text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider w-10">#</th>
                  <th className="py-2.5 px-2 text-left text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">Token</th>
                  <th className="py-2.5 px-2 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">Price</th>
                  <th className="py-2.5 px-2 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">24h %</th>
                  <th className="py-2.5 px-2 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">Volume</th>
                  <th className="py-2.5 px-2 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {displayTokens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-500">
                      No market data available
                    </td>
                  </tr>
                ) : (
                  displayTokens.map((token, i) => (
                    <TokenRow token={token} rank={i + 1} key={token.id} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800/50 bg-gray-950/30">
            <p className="text-[10px] text-gray-600">
              Powered by CoinGecko · Envio HyperSync
            </p>
            {marketData?.timestamp && (
              <p className="text-[10px] text-gray-600 tabular-nums">
                Updated {new Date(marketData.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
