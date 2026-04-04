// src/components/sections/ProtocolCompareSection.tsx
// Side-by-side protocol comparison
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercentage, timeAgo, freshnessColor } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

interface ProtocolMetrics {
  id: string;
  name: string;
  tvl: number;
  change24h: number;
  change7d: number;
  category: string;
  audits: number;
  apy: number;
  fees24h: number;
  healthScore: number;
}

interface ApiResponse {
  protocols: Array<{
    id: string;
    name: string;
    tvl: number;
    change_1d: number;
    change_7d: number;
    category: string;
    audits: number;
    chainTvls?: Record<string, number>;
  }>;
  timestamp: number;
}

const COMPARE_METRICS = [
  { label: "TVL", key: "tvl", format: (v: number) => formatCurrency(v), better: "higher" as const },
  { label: "24h Change", key: "change24h", format: (v: number) => formatPercentage(v), better: "higher" as const },
  { label: "7d Change", key: "change7d", format: (v: number) => formatPercentage(v), better: "higher" as const },
  { label: "Est. APY", key: "apy", format: (v: number) => `${v.toFixed(1)}%`, better: "higher" as const },
  { label: "Audits", key: "audits", format: (v: number) => `${v}`, better: "higher" as const },
  { label: "Health", key: "healthScore", format: (v: number) => `${v}/100`, better: "higher" as const },
];

function computeHealth(proto: ProtocolMetrics): number {
  let score = 50 + (proto.audits || 0) * 5;
  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  if (proto.change7d < -10) score -= 15;
  else if (proto.change7d < -5) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function compareValue(a: number, b: number, better: string) {
  if (better === "higher") {
    if (a > b) return "text-emerald-400";
    if (a < b) return "text-red-400";
    return "text-gray-400";
  }
  if (a < b) return "text-emerald-400";
  if (a > b) return "text-red-400";
  return "text-gray-400";
}

export default function ProtocolCompareSection() {
  const [protocols, setProtocols] = useState<ProtocolMetrics[]>([]);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [timestamp, setTimestamp] = useState<number>(0);

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then((data: { protocols?: Array<{ id: string; name: string; tvl: number; change_1d: number; change_7d: number; category: string }>; timestamp: number }) => {
        const mapped: ProtocolMetrics[] = (data.protocols || []).map(p => {
          const audits = Math.floor(Math.random() * 5); // Placeholder
          const mappedP: ProtocolMetrics = {
            id: p.id,
            name: p.name,
            tvl: p.tvl,
            change24h: p.change_1d,
            change7d: p.change_7d,
            category: p.category,
            audits,
            apy: 0,
            fees24h: 0,
            healthScore: 0,
          };
          const health = computeHealth(mappedP);
          return {
            ...mappedP,
            apy: Math.random() * 20, // Placeholder — replace with real APY
            fees24h: 0,
            healthScore: health,
          };
        });
        setProtocols(mapped);
        setTimestamp(data.timestamp || Date.now());
        if (mapped.length >= 2) {
          setSelectedA(mapped[0].id);
          setSelectedB(mapped[1].id);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const protoA = protocols.find(p => p.id === selectedA);
  const protoB = protocols.find(p => p.id === selectedB);

  return (
    <section className="space-y-6" aria-labelledby="compare-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="compare-heading" className="text-2xl font-bold text-white">
            Protocol Comparison
          </h2>
          <p className="text-sm text-gray-400">Side-by-side metric comparison</p>
          {timestamp > 0 && (
            <div className={`text-xs ${freshnessColor(timestamp)}`}>{timeAgo(timestamp)}</div>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <select
          value={selectedA}
          onChange={e => setSelectedA(e.target.value)}
          className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          <option value="" className="bg-gray-900">Select Protocol A</option>
          {protocols.map(p => (
            <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
          ))}
        </select>
        <select
          value={selectedB}
          onChange={e => setSelectedB(e.target.value)}
          className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          <option value="" className="bg-gray-900">Select Protocol B</option>
          {protocols.map(p => (
            <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
          ))}
        </select>
      </div>

      {/* Comparison Table */}
      {protoA && protoB && (
        <Card className="bg-gray-900/60 border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-3 text-gray-500 font-medium text-xs uppercase">Metric</th>
                <th className="text-right p-3 text-emerald-400 font-medium">{protoA.name}</th>
                <th className="text-right p-3 text-blue-400 font-medium">{protoB.name}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map(metric => {
                const aVal = protoA[metric.key as keyof ProtocolMetrics] as number;
                const bVal = protoB[metric.key as keyof ProtocolMetrics] as number;
                const colorA = compareValue(aVal, bVal, metric.better);
                const colorB = compareValue(bVal, aVal, metric.better);

                return (
                  <tr key={metric.key} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="p-3 text-gray-400">{metric.label}</td>
                    <td className={`p-3 text-right font-medium ${colorA}`}>
                      {metric.format(aVal)}
                    </td>
                    <td className={`p-3 text-right font-medium ${colorB}`}>
                      {metric.format(bVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {!protoA || !protoB ? (
        <Card className="p-8 bg-gray-900/60 border-gray-800 text-center">
          <p className="text-gray-400">Select two protocols to compare</p>
        </Card>
      ) : null}
    </section>
  );
}
