// src/components/sections/WhalesSection.tsx
"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  Filter,
  Activity,
  Clock,
  Wallet,
  ArrowRightLeft,
} from "lucide-react";
import { MetricSkeleton, CircleRowSkeleton } from "@/components/ui/Skeleton";

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  timestamp: string;
  type: string;
  tokenSymbol?: string;
  protocol?: string;
  blockNumber?: number;
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
  source?: string;
  timestamp: number;
}

function formatUSD(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  swap: { label: "Swap", color: "text-purple-400", bgColor: "bg-purple-900/30" },
  transfer: { label: "Transfer", color: "text-emerald-400", bgColor: "bg-emerald-900/30" },
  deposit: { label: "Deposit", color: "text-blue-400", bgColor: "bg-blue-900/30" },
  withdraw: { label: "Withdraw", color: "text-orange-400", bgColor: "bg-orange-900/30" },
  borrow: { label: "Borrow", color: "text-yellow-400", bgColor: "bg-yellow-900/30" },
  repay: { label: "Repay", color: "text-emerald-400", bgColor: "bg-emerald-900/30" },
  liquidity_add: { label: "Add Liq", color: "text-blue-400", bgColor: "bg-blue-900/30" },
  liquidity_remove: { label: "Remove Liq", color: "text-orange-400", bgColor: "bg-orange-900/30" },
};

export default function WhalesSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/whales")
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    fetch("/api/whales")
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setIsLoading(false); })
      .catch((e) => { setError(e.message); setIsLoading(false); });
  };

  const filteredWhales = data?.whales.filter(
    (w) => filterType === "all" || w.type === filterType
  ) || [];

  if (error && !data) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Whale Tracker</h2>
        <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20">
          <AlertCircle className="h-6 w-6 text-red-400 mb-3" />
          <p className="text-red-400 font-medium mb-1">Whale data unavailable</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors">Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="whales-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="whales-heading" className="text-2xl sm:text-3xl font-bold text-white">
            Whale Tracker
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Large transactions ({">"}$50K) across Aerodrome, Uniswap V3, Seamless
          </p>
        </div>
        <button onClick={handleRefresh} disabled={isLoading} className="p-2 bg-emerald-900/30 border border-emerald-500/20 rounded-xl hover:bg-emerald-800/50 transition-colors disabled:opacity-50 flex-shrink-0" aria-label="Refresh">
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary Cards */}
      {isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4"><MetricSkeleton /></div>
          ))}
        </div>
      ) : data?.summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Total Flows</p>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{data.summary.total}</p>
          </div>
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Largest</p>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatUSD(data.summary.largest)}</p>
          </div>
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Avg Size</p>
            <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{formatUSD(data.summary.avgSize)}</p>
          </div>
          <div className="bg-gray-900/60 border border-emerald-500/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-1">Source</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-400 truncate">{data.source || "indexer"}</p>
          </div>
        </div>
      ) : null}

      {/* Type filters */}
      {data?.summary.types && Object.keys(data.summary.types).length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          <button
            onClick={() => setFilterType("all")}
            className={`px-2.5 py-1.5 text-xs rounded-lg whitespace-nowrap ${filterType === "all" ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30" : "bg-gray-800/50 text-gray-400 hover:text-white"}`}
          >
            All ({data.whales.length})
          </button>
          {Object.entries(data.summary.types).map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] || { label: type, color: "text-gray-400" };
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1.5 text-xs rounded-lg whitespace-nowrap ${filterType === type ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30" : "bg-gray-800/50 text-gray-400 hover:text-white"}`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading && !data ? (
          <div className="p-6"><CircleRowSkeleton rows={5} /></div>
        ) : filteredWhales.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">
              {data?.whales.length === 0
                ? "No large transactions in the last 30 minutes"
                : `No ${filterType} transactions found`}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Transactions above $50,000 will appear here when detected
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {filteredWhales.slice(0, 25).map((w) => {
              const cfg = TYPE_CONFIG[w.type] || { label: w.type, color: "text-gray-400", bgColor: "bg-gray-800/30" };
              return (
                <div key={w.hash} className="flex items-center gap-3 p-3 sm:p-4 hover:bg-gray-800/20 transition-colors">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.bgColor}`}>
                    {w.type === "swap" ? <ArrowRightLeft className={`h-4 w-4 ${cfg.color}`} /> :
                     w.type === "deposit" || w.type === "repay" ? <ArrowDownRight className={`h-4 w-4 ${cfg.color}`} /> :
                     <ArrowUpRight className={`h-4 w-4 ${cfg.color}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                      {w.protocol && <span className="text-[10px] text-gray-600 capitalize">{w.protocol}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {w.from} → {w.to}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-white tabular-nums">{formatUSD(w.valueUSD)}</p>
                    <p className="text-[10px] text-gray-500">{w.value}</p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-[10px] text-gray-500 tabular-nums">{timeSince(w.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {data && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800/50 bg-gray-950/30">
            <p className="text-[10px] text-gray-600">
              Powered by {data.source === "envio-hypersync" ? "Envio HyperSync" : "Etherscan V2"}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-gray-600">
              <Clock className="h-3 w-3" />
              {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
