"use client";

// src/components/sections/BaseNetworkMetrics.tsx
// Overview metric cards for Base Network — TVL, Protocols, Avg APY.
// Shows source, confidence badge, and last-updated freshness.

import { Card } from "@tremor/react";
import { Network, DollarSign, TrendingUp, Database } from "lucide-react";
import { useMemo } from "react";
import { timeAgo, freshnessColor, dataConfidence } from "@/lib/utils";

interface BaseMetricsProps {
  data: {
    totalTvl: number;
    totalProtocols: number;
    avgApy: number;
    change24h: number;
    _source?: string;
    _updatedAt?: number;
  } | null;
  isLoading: boolean;
}

const CONFIDENCE_COLORS = {
  high:   "text-emerald-400 bg-emerald-900/30 border-emerald-500/30",
  medium: "text-yellow-400 bg-yellow-900/30 border-yellow-500/30",
  low:    "text-red-400 bg-red-900/30 border-red-500/30",
};

const CONFIDENCE_LABELS = { high: "Live", medium: "Cached", low: "Stale" };

export default function BaseNetworkMetrics({ data, isLoading }: BaseMetricsProps) {
  const source = data?._source ?? "defillama";
  const updatedAt = data?._updatedAt ?? null;
  const ageMs = updatedAt ? Date.now() - updatedAt : null;
  const confidence = useMemo(
    () => data ? dataConfidence({ source, ageMs: ageMs ?? Infinity, isStale: false }) : "low",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  const metrics = [
    {
      label: "Base TVL",
      value: data?.totalTvl ? `$${(data.totalTvl / 1e9).toFixed(2)}B` : "—",
      icon: DollarSign,
      change: data?.change24h ?? null,
      tooltip: "Total Value Locked across all Base DeFi protocols (DefiLlama methodology)",
    },
    {
      label: "Protocols",
      value: data?.totalProtocols || "—",
      icon: Network,
      change: null,
      tooltip: "Active DeFi protocols on Base with TVL > $100K",
    },
    {
      label: "Avg APY",
      value: data?.avgApy ? `${data.avgApy.toFixed(2)}%` : "—",
      icon: TrendingUp,
      change: null,
      tooltip: "Weighted average APY across Base yield pools (DeFiLlama Yields)",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Data source + freshness bar */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          Source: <span className="text-gray-400 font-medium ml-0.5">{source}</span>
        </span>
        <span className="flex items-center gap-2">
          {updatedAt && (
            <span className={freshnessColor(updatedAt)}>
              {timeAgo(updatedAt)}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${CONFIDENCE_COLORS[confidence]}`}>
            {CONFIDENCE_LABELS[confidence]}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          const isPositive = metric.change !== null && metric.change > 0;

          return (
            <Card
              key={idx}
              className="relative !bg-gradient-to-br !from-gray-900/80 !via-gray-800/70 !to-black/90 border-0 p-3 sm:p-4 rounded-xl shadow-lg before:absolute before:inset-0 before:rounded-xl before:p-[1.5px] before:bg-gradient-to-br before:from-emerald-500/30 before:via-transparent before:to-emerald-500/10 before:-z-10"
              title={metric.tooltip}
            >
              {isLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-700/50 rounded w-2/3"></div>
                  <div className="h-5 bg-gray-700/50 rounded w-3/4"></div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-gray-400 uppercase font-medium">
                      {metric.label}
                    </span>
                    <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400/70" />
                  </div>
                  <p className="text-sm sm:text-lg font-bold text-white truncate">
                    {metric.value}
                  </p>
                  {metric.change !== null && (
                    <p className={`text-[10px] sm:text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {isPositive ? "↑" : "↓"} {Math.abs(metric.change).toFixed(2)}%
                      <span className="text-gray-500 ml-1">24h</span>
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
