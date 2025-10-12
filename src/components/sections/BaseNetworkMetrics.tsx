// src/components/sections/BaseNetworkMetrics.tsx
"use client";

import { Card } from "@tremor/react";
import { Network, DollarSign, Activity, TrendingUp } from "lucide-react";

interface BaseMetricsProps {
  data: {
    totalTvl: number;
    totalProtocols: number;
    avgApy: number;
    change24h: number;
  } | null;
  isLoading: boolean;
}

export default function BaseNetworkMetrics({ data, isLoading }: BaseMetricsProps) {
  const metrics = [
    {
      label: "Base TVL",
      value: data?.totalTvl ? `$${(data.totalTvl / 1e9).toFixed(2)}B` : "N/A",
      icon: DollarSign,
      change: data?.change24h || null,
    },
    {
      label: "Protocols",
      value: data?.totalProtocols || "N/A",
      icon: Network,
      change: null,
    },
    {
      label: "Avg APY",
      value: data?.avgApy ? `${data.avgApy.toFixed(2)}%` : "N/A",
      icon: TrendingUp,
      change: null,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        const isPositive = metric.change !== null && metric.change > 0;
        
        return (
          <Card
            key={idx}
            className="relative !bg-gradient-to-br !from-gray-900/80 !via-gray-800/70 !to-black/90 border-0 p-3 sm:p-4 rounded-xl shadow-lg before:absolute before:inset-0 before:rounded-xl before:p-[1.5px] before:bg-gradient-to-br before:from-emerald-500/30 before:via-transparent before:to-emerald-500/10 before:-z-10"
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
                  <p className={`text-[10px] sm:text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? '↑' : '↓'} {Math.abs(metric.change).toFixed(2)}%
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
