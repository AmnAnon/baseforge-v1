// src/components/sections/MEVSection.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  RefreshCw,
  AlertTriangle,
  ArrowRightLeft,
  Layers,
  BarChart3,
  Clock,
} from "lucide-react";
import { MetricSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";

interface MEVEvent {
  txHash: string;
  type: "likely_arbitrage" | "large_swap" | "possible_sandwich";
  protocol: string;
  amountUSD: number;
  sender: string;
  timestamp: number;
  blockNumber: number;
}

interface MEVStats {
  total24h: number;
  arbitrageCount: number;
  sandwichCount: number;
  largeSwapCount: number;
  estimatedExtractedUSD: number;
  avgSwapSize: number;
}

interface MEVResponse {
  events: MEVEvent[];
  stats: MEVStats;
  source: string;
  dataNote: string;
  timestamp: number;
  isStale: boolean;
}

function formatUSD(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function timeSince(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Zap }> = {
  likely_arbitrage: { label: "Likely Arb", color: "text-yellow-400", bgColor: "bg-yellow-900/30", icon: Zap },
  possible_sandwich: { label: "Poss. Sandwich", color: "text-red-400", bgColor: "bg-red-900/30", icon: Layers },
  large_swap: { label: "Large Swap", color: "text-blue-400", bgColor: "bg-blue-900/30", icon: ArrowRightLeft },
};

export default function MEVSection() {
  const [data, setData] = useState<MEVResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mev")
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    fetch("/api/mev")
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setIsLoading(false); })
      .catch((e) => { setError(e.message); setIsLoading(false); });
  };

  return (
    <section className="space-y-5" aria-labelledby="mev-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="mev-heading" className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            MEV Activity
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Large swaps & MEV-like patterns on Base
          </p>
        </div>
        <button onClick={handleRefresh} disabled={isLoading} className="p-2 bg-emerald-900/30 border border-emerald-500/20 rounded-xl hover:bg-emerald-800/50 transition-colors disabled:opacity-50 flex-shrink-0" aria-label="Refresh">
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Loading */}
      {isLoading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4"><MetricSkeleton /></div>
            ))}
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <TableRowSkeleton key={i} cols={4} />)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20">
          <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
          <p className="text-red-400 font-medium mb-1">MEV data unavailable</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors">Retry</button>
        </div>
      )}

      {/* Data loaded */}
      {data && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Events Detected</p>
              <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{data.stats.total24h}</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Likely Arbitrage</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-400 tabular-nums">{data.stats.arbitrageCount}</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Poss. Sandwich</p>
              <p className="text-xl sm:text-2xl font-bold text-red-400 tabular-nums">{data.stats.sandwichCount}</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Est. Extracted</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{formatUSD(data.stats.estimatedExtractedUSD)}</p>
            </div>
          </div>

          {/* Events table */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            {data.events.length === 0 ? (
              <div className="p-12 text-center">
                <BarChart3 className="h-10 w-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No large swaps detected recently</p>
                <p className="text-xs text-gray-600 mt-1">Swaps above $50K will appear here when they occur</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="py-2.5 px-3 text-left text-[10px] sm:text-xs text-gray-500 font-medium uppercase">Type</th>
                      <th className="py-2.5 px-3 text-left text-[10px] sm:text-xs text-gray-500 font-medium uppercase">Protocol</th>
                      <th className="py-2.5 px-3 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase">Amount</th>
                      <th className="py-2.5 px-3 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase hidden sm:table-cell">When</th>
                      <th className="py-2.5 px-3 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase hidden md:table-cell">Block</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((event) => {
                      const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.large_swap;
                      const Icon = cfg.icon;
                      return (
                        <tr key={event.txHash} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${cfg.bgColor}`}>
                                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                              </div>
                              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-sm text-white capitalize">{event.protocol}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-sm font-bold text-white tabular-nums">{formatUSD(event.amountUSD)}</span>
                          </td>
                          <td className="py-3 px-3 text-right hidden sm:table-cell">
                            <span className="text-xs text-gray-500 tabular-nums">{timeSince(event.timestamp)}</span>
                          </td>
                          <td className="py-3 px-3 text-right hidden md:table-cell">
                            <span className="text-xs text-gray-600 tabular-nums">{event.blockNumber.toLocaleString()}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800/50 bg-gray-950/30">
              <p className="text-[10px] text-gray-600 max-w-xs truncate">
                {data.dataNote}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-gray-600">
                <Clock className="h-3 w-3" />
                {new Date(data.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
