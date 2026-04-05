// src/components/sections/GasTrackerSection.tsx
// Base L2 gas tracker — current fees + congestion indicator
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { timeAgo, freshnessColor } from "@/lib/utils";
import {
  Zap,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
} from "lucide-react";

interface GasData {
  l2BaseFee: number;
  l2BaseFeeGwei: number;
  l2PriorityFee: number;
  l1BlobFeeWei: number;
  totalCostTx: string;
  congestion: "low" | "medium" | "high";
  timestamp: number;
}

const CONGESTION_CONFIG = {
  low: {
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
    border: "border-emerald-500/30",
    label: "Low",
    icon: ArrowDownRight,
  },
  medium: {
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/30",
    label: "Medium",
    icon: Gauge,
  },
  high: {
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-500/30",
    label: "High",
    icon: ArrowUpRight,
  },
};

export default function GasTrackerSection({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [gas, setGas] = useState<GasData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gas");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setGas(await res.json());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGas();
    const interval = setInterval(fetchGas, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card className={`bg-gray-900/60 border-gray-800 ${compact ? "p-3" : "p-6"}`}>
        <div className={`animate-pulse ${compact ? "h-8" : "space-y-3"}`}>
          <div className="h-3 bg-gray-800 rounded w-20 mb-2" />
          <div className="h-6 bg-gray-800 rounded w-32" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900/60 border-gray-800 p-4">
        <p className="text-xs text-red-400">Gas data unavailable</p>
      </Card>
    );
  }

  if (!gas) return null;

  const config = CONGESTION_CONFIG[gas.congestion];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${config.color}`}>
        <Zap className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Gas: {gas.totalCostTx}</span>
        <Icon className="h-3 w-3" />
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="gas-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="gas-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            Gas Tracker
          </h2>
          <p className="text-sm text-gray-400">Base L2 + L1 blob fee estimates</p>
          <div className={`text-xs ${freshnessColor(gas.timestamp)}`}>
            {timeAgo(gas.timestamp)}
          </div>
        </div>
        <button
          onClick={fetchGas}
          disabled={isLoading}
          className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Refresh gas data"
        >
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={`${config.bg} ${config.border} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">Congestion</span>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <p className={`text-2xl font-bold ${config.color}`}>{config.label}</p>
          <p className="text-xs text-gray-500 mt-1">L2 Base Fee: {gas.l2BaseFeeGwei} Gwei</p>
        </Card>

        <Card className="bg-gray-900/60 border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">Tx Cost Est.</span>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-white">{gas.totalCostTx}</p>
          <p className="text-xs text-gray-500 mt-1">Per 21k gas typical tx</p>
        </Card>

        <Card className="bg-gray-900/60 border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase">L1 Blob Fee</span>
            <Gauge className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {(gas.l1BlobFeeWei / 1e9).toFixed(0)}G
          </p>
          <p className="text-xs text-gray-500 mt-1">Per tx blob posting cost</p>
        </Card>
      </div>

      {/* Timing Advice */}
      <Card className="bg-gray-900/60 border-gray-800 p-4">
        <p className="text-sm text-gray-400">
          {gas.congestion === "low" && (
            <span className="text-emerald-400">
              {""}
              Good time to transact — Base gas is low.
            </span>
          )}
          {gas.congestion === "medium" && (
            <span className="text-yellow-400">
              {""}
              Moderate congestion. No rush, but not the cheapest time.
            </span>
          )}
          {gas.congestion === "high" && (
            <span className="text-red-400">
              {""}
              High congestion — consider waiting for low fee periods.
            </span>
          )}
        </p>
      </Card>
    </section>
  );
}
