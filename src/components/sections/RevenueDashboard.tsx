// src/components/sections/RevenueDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { MetricSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";

interface ProtocolRevenue {
  name: string;
  category: string;
  fees24h: number;
  fees7d: number;
  feesAnnualized: number;
  revenue24h: number;
  revenueAnnualized: number;
}

interface RevenueResponse {
  protocols: ProtocolRevenue[];
  aggregate: {
    totalFees24h: number;
    totalFeesAnnualized: number;
    totalRevenue24h: number;
    protocolCount: number;
    timestamp: number;
  };
  timestamp: number;
  isStale?: boolean;
}

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"fees24h" | "revenue24h" | "feesAnnualized">("fees24h");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/revenue")
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    fetch("/api/revenue")
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setIsLoading(false); })
      .catch((e) => { setError(e.message); setIsLoading(false); });
  };

  const sorted = data?.protocols
    ? [...data.protocols].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))
    : [];

  return (
    <section className="space-y-5" aria-labelledby="revenue-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="revenue-heading" className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-400" />
            Protocol Revenue
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Real fees from DefiLlama — not estimates</p>
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
            {[1, 2, 3, 4, 5].map((i) => <TableRowSkeleton key={i} cols={5} />)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20">
          <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
          <p className="text-red-400 font-medium mb-1">Revenue data unavailable</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors">Retry</button>
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Fees (24h)</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{formatUSD(data.aggregate.totalFees24h)}</p>
            </div>
            <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Revenue (24h)</p>
              <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatUSD(data.aggregate.totalRevenue24h || 0)}</p>
            </div>
            <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Annualized</p>
              <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatUSD(data.aggregate.totalFeesAnnualized)}</p>
            </div>
            <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Protocols</p>
              <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{data.aggregate.protocolCount}</p>
            </div>
          </div>

          {/* Sort tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {([
              { id: "fees24h" as const, label: "By Fees 24h", icon: BarChart3 },
              { id: "revenue24h" as const, label: "By Revenue", icon: TrendingUp },
              { id: "feesAnnualized" as const, label: "By Annualized", icon: DollarSign },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  sortBy === id
                    ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30"
                    : "text-gray-400 hover:text-emerald-300 hover:bg-gray-800/30"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-2.5 px-3 text-center text-[10px] sm:text-xs text-gray-500 font-medium uppercase w-10">#</th>
                    <th className="py-2.5 px-3 text-left text-[10px] sm:text-xs text-gray-500 font-medium uppercase">Protocol</th>
                    <th className="py-2.5 px-3 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase">Fees 24h</th>
                    <th className="py-2.5 px-3 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase hidden sm:table-cell">Revenue 24h</th>
                    <th className="py-2.5 px-3 text-right text-[10px] sm:text-xs text-gray-500 font-medium uppercase hidden md:table-cell">Annualized</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={5} className="py-16 text-center text-gray-500">No revenue data available</td></tr>
                  ) : (
                    sorted.map((p, i) => (
                      <tr key={p.name} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 px-3 text-center"><span className="text-xs text-gray-500 tabular-nums">{i + 1}</span></td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-white text-sm">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.category}</p>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatUSD(p.fees24h)}</span>
                        </td>
                        <td className="py-3 px-3 text-right hidden sm:table-cell">
                          <span className="text-sm text-white tabular-nums">{formatUSD(p.revenue24h)}</span>
                        </td>
                        <td className="py-3 px-3 text-right hidden md:table-cell">
                          <span className="text-sm text-gray-400 tabular-nums">{formatUSD(p.feesAnnualized)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800/50 bg-gray-950/30">
              <p className="text-[10px] text-gray-600">Powered by DefiLlama Fees API</p>
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
