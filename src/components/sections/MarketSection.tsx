// src/components/sections/MarketSection.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@tremor/react";
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

interface TokenData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  tvl?: number;
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
}

function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `${value.toFixed(value < 0.01 ? 6 : 2)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TokenRow({ token, rank }: { token: TokenData; rank: number }) {
  return (
    <div className="flex items-center gap-4 p-3 hover:bg-gray-800/30 transition-colors rounded-lg group">
      <span className="text-sm text-gray-500 w-6 text-right tabular-nums">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white truncate">{token.name}</p>
          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            {token.symbol}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="text-right w-24">
        <p className="text-sm font-bold text-white tabular-nums">
          {formatUSD(token.price)}
        </p>
      </div>

      {/* Change */}
      <div
        className={`flex items-center gap-1 text-sm w-20 ${
          token.change24h >= 0 ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {token.change24h >= 0 ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
        <span className="tabular-nums">{token.change24h.toFixed(1)}%</span>
      </div>

      {/* Volume */}
      <div className="text-right w-24">
        <p className="text-sm text-gray-400 tabular-nums">
          {formatUSD(token.volume24h)}
        </p>
        <p className="text-xs text-gray-500">24h vol</p>
      </div>

      {/* Market Cap */}
      <div className="text-right w-24">
        <p className="text-sm text-gray-300 tabular-nums">
          {formatUSD(token.marketCap)}
        </p>
        <p className="text-xs text-gray-500">mcap</p>
      </div>
    </div>
  );
}

export default function MarketSection({
  data,
  isLoading: parentLoading,
}: {
  data?: ApiResponse | null;
  isLoading?: boolean;
}) {
  const [marketData, setMarketData] = useState<ApiResponse | null>(
    data ?? null
  );
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tokens" | "gainers" | "losers" | "volume">(
    "tokens"
  );

  useEffect(() => {
    const fetchMarket = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/market");
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        setMarketData(json);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMarket();
  }, []);

  if (error) {
    return (
      <Card className="p-6 bg-red-900/20 border-red-500/30">
        <AlertCircle className="h-6 w-6 text-red-400 mb-2" />
        <p className="text-red-400 font-medium">Market data unavailable</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            fetch("/api/market")
              .then((r) => r.json())
              .then((d) => setMarketData(d))
              .catch((e) => setError(e.message))
              .finally(() => setIsLoading(false));
          }}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
        >
          Retry
        </button>
      </Card>
    );
  }

  const loading = isLoading || parentLoading;

  const getDisplayTokens = () => {
    if (!marketData) return [];
    switch (tab) {
      case "gainers":
        if (marketData.topGainers.length > 0) return marketData.topGainers;
        return marketData.tokens
          .filter((t) => t.change24h > 0)
          .sort((a, b) => b.change24h - a.change24h)
          .slice(0, 5);
      case "losers":
        if (marketData.topLosers.length > 0) return marketData.topLosers;
        return marketData.tokens
          .filter((t) => t.change24h < 0)
          .sort((a, b) => a.change24h - b.change24h)
          .slice(0, 5);
      case "volume":
        return marketData.topByVolume;
      default:
        return marketData.tokens.sort((a, b) => b.marketCap - a.marketCap);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="market-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="market-heading" className="text-2xl font-bold text-white">
            Market Overview
          </h2>
          <p className="text-sm text-gray-400">
            {marketData?.tokens.length ?? "—"} tracked tokens
          </p>
        </div>

        <button
          onClick={() => {
            setIsLoading(true);
            fetch("/api/market")
              .then((r) => r.json())
              .then((d) => setMarketData(d))
              .catch((e) => setError(e.message))
              .finally(() => setIsLoading(false));
          }}
          disabled={isLoading}
          className="p-2 bg-emerald-900/30 border border-emerald-500/20 rounded-lg hover:bg-emerald-800/50 transition-colors disabled:opacity-50"
          aria-label="Refresh market data"
        >
          <RefreshCw
            className={`h-5 w-5 text-emerald-400 ${
              isLoading ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* Summary Cards */}
      {marketData?.summary && !loading && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Tokens
              </p>
            </div>
            <p className="text-2xl font-bold text-white">
              {marketData.summary.totalTokens}
            </p>
          </Card>
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              {marketData.summary.avgChange24h >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Avg 24h Change
              </p>
            </div>
            <p
              className={`text-2xl font-bold ${
                marketData.summary.avgChange24h >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {marketData.summary.avgChange24h >= 0 ? "+" : ""}
              {marketData.summary.avgChange24h.toFixed(2)}%
            </p>
          </Card>
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                24h Volume
              </p>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">
              {formatUSD(marketData.summary.totalVolume24h)}
            </p>
          </Card>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        {(
          [
            { id: "tokens", label: "All Tokens", icon: BarChart3 },
            { id: "gainers", label: "Top Gainers", icon: TrendingUp },
            { id: "losers", label: "Top Losers", icon: TrendingDown },
            { id: "volume", label: "By Volume", icon: DollarSign },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30"
                : "text-gray-400 hover:text-emerald-300 hover:bg-gray-800/30"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Token List */}
      {loading ? (
        <Card className="bg-gray-900/60 p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRowSkeleton key={i} cols={5} />
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-gray-900/60 border-gray-800">
          {/* Table Header */}
          <div className="flex items-center gap-4 p-3 border-b border-gray-800 text-xs text-gray-500">
            <span className="w-6 text-right">#</span>
            <span className="flex-1">Token</span>
            <span className="w-24 text-right">Price</span>
            <span className="w-20 text-right">24h %</span>
            <span className="w-24 text-right">Volume</span>
            <span className="w-24 text-right">Mcap</span>
          </div>

          <div className="divide-y divide-gray-800/50">
            {getDisplayTokens().length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No market data available
              </div>
            ) : (
              getDisplayTokens().map((token, i) => (
                <TokenRow token={token} rank={i + 1} key={token.id} />
              ))
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
