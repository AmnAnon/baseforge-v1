// src/components/charts/RiskScoreChart.tsx
// Historical risk score visualization — shows protocol health trend over time
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { timeAgo, freshnessColor } from "@/lib/utils";
import { AlertTriangle, TrendingUp, Loader2 } from "lucide-react";

interface RiskHistoryPoint {
  date: string;
  healthScore: number;
  tvl: number;
  change24h: number;
  tvlVolatility: number;
  category: string;
  audits: number;
}

interface RiskHistoryResponse {
  history: RiskHistoryPoint[];
  protocol: string;
}

const HEALTH_COLORS = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#ef4444",
};

function getHealthColor(score: number): string {
  if (score >= 70) return HEALTH_COLORS.high;
  if (score >= 50) return HEALTH_COLORS.medium;
  return HEALTH_COLORS.low;
}

export default function RiskScoreChart({
  protocol,
  isLoading: parentLoading,
}: {
  protocol?: string;
  isLoading?: boolean;
}) {
  const [history, setHistory] = useState<RiskHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const protocolName = protocol || "aerodrome";

  useEffect(() => {
    if (!protocolName) return;
    let cancelled = false;
    fetch(`/api/risk-history?protocol=${protocolName}`)
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((data: RiskHistoryResponse) => {
        if (!cancelled) {
          setHistory(data.history || []);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error("Risk history fetch error:", err);
          setError(err.message);
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [protocolName]);

  if (isLoading || parentLoading) {
    return (
      <Card className="bg-gray-900/60 border-gray-800 p-6">
        <div className="flex items-center gap-2 text-gray-400 mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading risk history...
        </div>
        <div className="h-[300px] bg-gray-800/50 rounded animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-500/30 p-6">
        <AlertTriangle className="h-5 w-5 text-red-400 mb-2" />
        <p className="text-red-400 text-sm">Risk history unavailable for {protocolName}</p>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="bg-gray-900/60 border-gray-800 p-6">
        <p className="text-gray-500 text-sm">No risk history available</p>
      </Card>
    );
  }

  const currentScore = history[history.length - 1]?.healthScore || 0;
  const prevScore = history[Math.max(0, history.length - 2)]?.healthScore || 0;
  const scoreTrend = currentScore > prevScore ? "up" : currentScore < prevScore ? "down" : "flat";

  return (
    <Card className="bg-gray-900/60 border-gray-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Risk Score History
          </h3>
          <p className="text-xs text-gray-500 mt-1">Health score trend over time</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold`} style={{ color: getHealthColor(currentScore) }}>
            {currentScore}
          </p>
          <div className={`flex items-center text-xs ${
            scoreTrend === "up" ? "text-emerald-400" : scoreTrend === "down" ? "text-red-400" : "text-gray-400"
          }`}>
            {scoreTrend === "up" ? "↑" : scoreTrend === "down" ? "↓" : "→"}
            <span className="ml-1">{currentScore - prevScore} from prior</span>
          </div>
        </div>
      </div>

      {history.length >= 2 && (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickCount={8} />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              domain={[0, 100]}
            />
            <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" />
            <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "healthScore") return [`${value}/100`, "Health"];
                return [value, name];
              }}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#e5e7eb",
              }}
            />
            <Area
              type="monotone"
              dataKey="healthScore"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#riskGradient)"
              name="Health Score"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-0.5 bg-emerald-500 rounded" />
          <span>High (70+)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-0.5 bg-yellow-500 rounded" />
          <span>Medium (50+)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-0.5 bg-red-500 rounded" />
          <span>Low (&lt;50)</span>
        </div>
      </div>
    </Card>
  );
}
