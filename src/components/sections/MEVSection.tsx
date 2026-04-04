// src/components/sections/MEVSection.tsx
// MEV activity overview — uses whale tx patterns as proxy until real MEV API is integrated
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, timeAgo, freshnessColor } from "@/lib/utils";
import {
  Zap,
  AlertTriangle,
  RefreshCw,
  Bot,
  Shield,
  Coins,
} from "lucide-react";

interface MEVStats {
  total24h: number;
  avgProfit: number;
  topType: string;
  botCount: number;
  estimatedExtractedUSD: number;
}

interface MEVEvent {
  blockNumber: number;
  txHash: string;
  type: string;
  botAddress: string;
  estimatedProfitUSD: number;
  timestamp: number;
}

interface MEVResponse {
  stats: MEVStats;
  events: MEVEvent[];
  comingSoon: boolean;
  timestamp: number;
}

export default function MEVSection() {
  const [data, setData] = useState<MEVResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mev");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <section className="space-y-6" aria-labelledby="mev-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="mev-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-400" />
            MEV Activity
          </h2>
          <p className="text-sm text-gray-400">
            Extracted value tracking on Base
          </p>
          {data?.timestamp && (
            <div className={`text-xs ${freshnessColor(data.timestamp)} mt-1`}>
              {timeAgo(data.timestamp)}
            </div>
          )}
        </div>
        <button onClick={fetchData} disabled={isLoading} className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50" aria-label="Refresh MEV data">
          <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data?.comingSoon && (
        <Card className="p-6 bg-yellow-900/20 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <Bot className="h-8 w-8 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">MEV Tracking Coming Soon</p>
              <p className="text-sm text-gray-400 mt-1">
                Real MEV detection requires block-level transaction analysis. We're integrating
                with specialized MEV APIs (EigenPhi, Flashbots) for accurate data.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Current whale tracking monitors large-value swaps as a proxy for MEV activity.
                This will be replaced with real bot detection data.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Placeholder: Whale-based MEV proxy */}
      {!data?.comingSoon && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">MEV Events (24h)</p>
              <p className="text-xl font-bold text-white">{data.stats.total24h}</p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Avg Profit/Event</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(data.stats.avgProfit)}
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Active Bots</p>
              <p className="text-xl font-bold text-white">{data.stats.botCount}</p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Est. Extracted</p>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(data.stats.estimatedExtractedUSD)}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* MEV Events List */}
      {data?.events?.length > 0 ? (
        <Card className="overflow-hidden bg-gray-900/60 border-gray-800">
          <div className="divide-y divide-gray-800">
            {data!.events.map((event, i) => {
              const typeIcon = event.type === "sandwich" ? <Shield className="h-4 w-4 text-yellow-400" /> :
                               event.type === "arbitrage" ? <Zap className="h-4 w-4 text-emerald-400" /> :
                               <Coins className="h-4 w-4 text-red-400" />;
              return (
                <div key={i} className="flex items-center gap-3 p-4 hover:bg-gray-800/20">
                  {typeIcon}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase text-gray-500 mr-2">{event.type}</span>
                    <span className="text-sm text-white">{event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}</span>
                  </div>
                  <span className="text-sm font-medium text-emerald-400">
                    +{formatCurrency(event.estimatedProfitUSD)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </section>
  );
}
