// src/components/sections/RevenueDashboard.tsx
// Protocol revenue breakdown — real fees vs token emissions
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercentage, timeAgo, freshnessColor } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Coins,
  AlertTriangle,
  Layers,
  BarChart3,
  RefreshCw,
} from "lucide-react";

interface ProtocolRevenue {
  name: string;
  category: string;
  tvl: number;
  fees24h: number;
  feesAnnualized: number;
  revenueToTvl: number;
  tokenEmissions: number;
  netYield: number;
  change24h: number;
  audits: number;
}

interface RevenueResponse {
  protocols: ProtocolRevenue[];
  aggregate: {
    totalFees24h: number;
    totalFeesAnnualized: number;
    protocolCount: number;
  };
  timestamp: number;
}

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"fees" | "yield" | "net">("fees");

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/revenue");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData(await res.json());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (error) {
    return (
      <Card className="p-6 bg-red-900/20 border-red-500/30">
        <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
        <p className="text-red-400 font-medium">Revenue data unavailable</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm">
          Retry
        </button>
      </Card>
    );
  }

  const profitCount = data?.protocols.filter(p => p.netYield > 0).length || 0;
  const printingCount = data?.protocols.filter(p => p.netYield < 0).length || 0;

  return (
    <section className="space-y-6" aria-labelledby="revenue-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="revenue-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-400" />
            Protocol Revenue
          </h2>
          <p className="text-sm text-gray-400">Real fees vs token emissions</p>
          {data?.timestamp && (
            <div className={`text-xs ${freshnessColor(data.timestamp)} mt-1`}>
              {timeAgo(data.timestamp)}
            </div>
          )}
        </div>
        <button onClick={fetchData} disabled={isLoading} className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50" aria-label="Refresh revenue data">
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gray-900/60 border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Fees (24h)</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(data.aggregate.totalFees24h)}</p>
          </Card>
          <Card className="bg-gray-900/60 border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-1">Fees (Annualized)</p>
            <p className="text-xl font-bold text-white">{formatCurrency(data.aggregate.totalFeesAnnualized)}</p>
          </Card>
          <Card className="bg-gray-900/60 border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-1">Tracking</p>
            <p className="text-xl font-bold text-white">{data.aggregate.protocolCount} protocols</p>
          </Card>
          <Card className="bg-gray-900/60 border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-1">Profitable</p>
            <p className="text-xl font-bold text-emerald-400">{profitCount}</p>
          </Card>
          <Card className="bg-gray-900/60 border-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-1">Token Printing</p>
            <p className="text-xl font-bold text-red-400">{printingCount}</p>
          </Card>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2">
        {[
          { key: "fees" as const, label: "Fees Generated", icon: BarChart3 },
          { key: "yield" as const, label: "Revenue-to-TVL", icon: TrendingUp },
          { key: "net" as const, label: "Net Yield", icon: Coins },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === key
                ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30"
                : "bg-gray-800/50 text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Protocol Table */}
      <Card className="overflow-hidden bg-gray-900/60 border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-3 text-gray-500 font-medium text-xs uppercase">Protocol</th>
              <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">TVL</th>
              {view === "fees" && (
                <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Fees 24h</th>
              )}
              {view === "fees" && (
                <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Annualized</th>
              )}
              {view === "yield" && (
                <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Rev/TVL %</th>
              )}
              {view === "yield" && (
                <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Real Yield</th>
              )}
              {view === "net" && (
                <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Net Yield/Day</th>
              )}
              {view === "net" && (
                <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Emissions/Day</th>
              )}
              <th className="text-right p-3 text-gray-500 font-medium text-xs uppercase">Audits</th>
            </tr>
          </thead>
          <tbody>
            {data?.protocols.map((proto, i) => {
              const netColor = proto.netYield > 0 ? "text-emerald-400" : "text-red-400";
              return (
                <tr key={proto.name} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="p-3">
                    <p className="font-medium text-white">{proto.name}</p>
                    <p className="text-xs text-gray-500">{proto.category}</p>
                  </td>
                  <td className="p-3 text-right text-gray-300">{formatCurrency(proto.tvl)}</td>

                  {view === "fees" && <td className="p-3 text-right text-emerald-400">{formatCurrency(proto.fees24h)}</td>}
                  {view === "fees" && <td className="p-3 text-right text-white">{formatCurrency(proto.feesAnnualized)}</td>}

                  {view === "yield" && <td className={`p-3 text-right font-medium ${proto.revenueToTvl > 5 ? "text-emerald-400" : "text-gray-400"}`}>{proto.revenueToTvl.toFixed(2)}%</td>}
                  {view === "yield" && (
                    <td className={`p-3 text-right font-medium ${proto.revenueToTvl > 5 ? "text-emerald-400" : "text-gray-400"}`}>
                      {proto.revenueToTvl > 0 ? `${proto.revenueToTvl.toFixed(1)}%` : "N/A"}
                    </td>
                  )}

                  {view === "net" && <td className={`p-3 text-right font-medium ${netColor}`}>{formatCurrency(proto.netYield)}</td>}
                  {view === "net" && <td className="p-3 text-right text-gray-400">{formatCurrency(proto.tokenEmissions)}</td>}

                  <td className="p-3 text-right text-gray-400">{proto.audits > 0 ? proto.audits : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
