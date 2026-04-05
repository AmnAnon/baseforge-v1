"use client";

import { useEffect, useState } from "react";
import { Card } from "@tremor/react";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Filter,
  Activity,
} from "lucide-react";

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  timestamp: string;
  type: "swap" | "transfer" | "add_liquidity" | "remove_liquidity";
  tokenSymbol?: string;
}

interface WhaleSummary {
  total: number;
  largest: number;
  avgSize: number;
  types: Record<string, number>;
}

interface ApiResponse {
  whales: WhaleTransaction[];
  summary: WhaleSummary;
  timestamp: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const typeColors: Record<string, string> = {
  swap: "text-purple-400",
  transfer: "text-emerald-400",
  add_liquidity: "text-blue-400",
  remove_liquidity: "text-orange-400",
};

const typeLabels: Record<string, string> = {
  swap: "Swap",
  transfer: "Transfer",
  add_liquidity: "Add Liquidity",
  remove_liquidity: "Remove Liquidity",
};

export default function WhalesSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchWhales = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whales");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWhales();
  }, []);

  const filteredWhales = data?.whales.filter(
    w => filterType === "all" || w.type === filterType
  ) || [];

  if (error) {
    return (
      <Card className="p-6 bg-gray-900/60 border-red-500/30">
        <AlertCircle className="h-6 w-6 text-red-400 mb-2" />
        <p className="text-red-400 font-medium">Whale data unavailable</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button
          onClick={fetchWhales}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="whales-heading">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 id="whales-heading" className="text-2xl font-bold text-white">
            Whale Tracker
          </h2>
          <p className="text-sm text-gray-400">
            Large Base chain transactions ({">"}{formatUSD(data?.summary.avgSize || 50000)})
          </p>
        </div>
        <button
          onClick={fetchWhales}
          disabled={isLoading}
          className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Refresh whale data"
        >
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Total Whales</p>
            <p className="text-2xl font-bold text-white">{data.summary.total}</p>
          </Card>
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Largest</p>
            <p className="text-2xl font-bold text-white">
              {formatUSD(data.summary.largest)}
            </p>
          </Card>
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Avg Size</p>
            <p className="text-2xl font-bold text-white">
              {formatUSD(data.summary.avgSize)}
            </p>
          </Card>
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Last Update</p>
            <p className="text-xl font-bold text-emerald-400 tabular-nums">
              {data.timestamp ? timeAgo(new Date(data.timestamp).toISOString()) : "—"}
            </p>
          </Card>
        </div>
      )}

      {/* Transaction Type Filter */}
      {data?.summary.types && Object.keys(data.summary.types).length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-gray-500" />
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1 text-sm rounded-md ${
              filterType === "all"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All ({data.whales.length})
          </button>
          {Object.entries(data.summary.types).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-sm rounded-md ${
                filterType === type
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {typeLabels[type] || type} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Whale Table */}
      <Card className="overflow-hidden bg-gray-900/60 border-gray-800">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-6 bg-gray-800 rounded animate-pulse w-48" />
                <div className="h-6 bg-gray-800 rounded animate-pulse w-32" />
                <div className="h-6 bg-gray-800 rounded animate-pulse w-24" />
              </div>
            ))}
          </div>
        ) : filteredWhales.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No whale transactions found</p>
            <p className="text-sm text-gray-500 mt-1">
              Large transactions ({">"}{formatUSD(50000)}) will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredWhales.slice(0, 20).map(w => (
              <div
                key={w.hash}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors"
              >
                {/* Type Icon */}
                <div
                  className={`p-2 rounded-lg ${
                    w.type === "swap"
                      ? "bg-purple-900/30"
                      : w.type === "transfer"
                      ? "bg-emerald-900/30"
                      : "bg-blue-900/30"
                  }`}
                >
                  {w.type === "swap" ? (
                    <ArrowUpRight className="h-5 w-5 text-purple-400" />
                  ) : w.type === "transfer" ? (
                    <ArrowDownRight className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Activity className="h-5 w-5 text-blue-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {w.from} → {w.to}
                  </p>
                  <p className="text-xs text-gray-500">
                    {typeLabels[w.type]} • {timeAgo(w.timestamp)}
                  </p>
                </div>

                {/* Value */}
                <div className="text-right">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {formatUSD(w.valueUSD)}
                  </p>
                  <p className="text-xs text-gray-500">{w.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
