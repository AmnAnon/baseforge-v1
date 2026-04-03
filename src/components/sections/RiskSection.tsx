// src/components/sections/RiskSection.tsx
// Protocol risk dashboard — health scores, audit status, concentration risk
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProtocolRisk {
  id: string;
  name: string;
  tvl: number;
  dominanceScore: number;
  healthScore: number;
  riskScore: number;
  auditStatus: "audited" | "unaudited" | "partial";
  auditCount: number;
  forkedFrom?: string[];
  ageDays: number;
  tvlChange7d: number;
  tvlVolatility: number;
  category: string;
  oracles: string[];
  riskFactors: string[];
  warning?: string;
}

interface RiskSummary {
  totalAnalyzed: number;
  avgHealthScore: number;
  highRiskCount: number;
  unauditedCount: number;
  dominantProtocol?: string;
  concentrationRisk: "LOW" | "MEDIUM" | "HIGH";
  totalBaseTVL: number;
}

interface ApiResponse {
  protocols: ProtocolRisk[];
  summary: RiskSummary;
  timestamp: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function HealthBadge({ score }: { score: number }) {
  const isHigh = score >= 70;
  const isMedium = score >= 50;

  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
        isHigh
          ? "bg-emerald-900/50 text-emerald-400 border border-emerald-500/30"
          : isMedium
          ? "bg-yellow-900/50 text-yellow-400 border border-yellow-500/30"
          : "bg-red-900/50 text-red-400 border border-red-500/30"
      }`}
    >
      <span className="tabular-nums">{score}</span>
    </div>
  );
}

function AuditBadge({ status }: { status: string }) {
  const icon =
    status === "audited" ? (
      <ShieldCheck className="h-4 w-4 text-emerald-400" />
    ) : status === "partial" ? (
      <Shield className="h-4 w-4 text-yellow-400" />
    ) : (
      <ShieldAlert className="h-4 w-4 text-red-400" />
    );

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
        status === "audited"
          ? "bg-emerald-900/30 text-emerald-400"
          : status === "partial"
          ? "bg-yellow-900/30 text-yellow-400"
          : "bg-red-900/30 text-red-400"
      }`}
    >
      {icon}
      <span className="uppercase font-medium">{status}</span>
    </div>
  );
}

function RiskFactorList({ factors }: { factors: string[] }) {
  if (factors.length === 0) {
    return <span className="text-emerald-400 text-xs">No significant risks</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {factors.map((factor, i) => (
        <span
          key={i}
          className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded border border-red-500/20"
        >
          {factor}
        </span>
      ))}
    </div>
  );
}

export default function RiskSection({
  isLoading: parentLoading,
}: {
  isLoading?: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/risk");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  if (error) {
    return (
      <Card className="p-6 bg-red-900/20 border-red-500/30">
        <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
        <p className="text-red-400 font-medium">Risk analysis unavailable</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
        <button
          onClick={() => fetchRisk()}
          className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm"
        >
          Retry
        </button>
      </Card>
    );
  }

  const loading = isLoading || parentLoading;

  return (
    <section className="space-y-6" aria-labelledby="risk-heading">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 id="risk-heading" className="text-2xl font-bold text-white">
            Protocol Risks
          </h2>
          <p className="text-sm text-gray-400">
            Health scores & risk assessment
          </p>
        </div>
        <button
          onClick={() => fetchRisk()}
          disabled={loading}
          className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Refresh risk data"
        >
          <RefreshCw
            className={`h-5 w-5 text-emerald-400 ${
              loading ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* Summary Cards */}
      {data?.summary && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Avg Health</p>
            <div className="flex items-center gap-2">
              <span
                className={`text-2xl font-bold ${
                  data.summary.avgHealthScore >= 60
                    ? "text-emerald-400"
                    : data.summary.avgHealthScore >= 40
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {data.summary.avgHealthScore}
              </span>
              <span className="text-xs text-gray-500">/100</span>
            </div>
          </Card>

          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">High Risk</p>
            <span
              className={`text-2xl font-bold ${
                data.summary.highRiskCount > 0
                  ? "text-red-400"
                  : "text-emerald-400"
              }`}
            >
              {data.summary.highRiskCount}
            </span>
          </Card>

          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Unaudited</p>
            <span
              className={`text-2xl font-bold ${
                data.summary.unauditedCount > 5
                  ? "text-red-400"
                  : data.summary.unauditedCount > 2
                  ? "text-yellow-400"
                  : "text-emerald-400"
              }`}
            >
              {data.summary.unauditedCount}
            </span>
          </Card>

          <Card className="!bg-gray-900/60 border-emerald-500/20 p-4">
            <p className="text-sm text-gray-400 mb-1">Concentration</p>
            <span
              className={`text-2xl font-bold ${
                data.summary.concentrationRisk === "HIGH"
                  ? "text-red-400"
                  : data.summary.concentrationRisk === "MEDIUM"
                  ? "text-yellow-400"
                  : "text-emerald-400"
              }`}
            >
              {data.summary.concentrationRisk}
            </span>
          </Card>
        </div>
      )}

      {/* Risk Table */}
      {loading ? (
        <Card className="bg-gray-900/60 border-gray-800 p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-32" />
                  <div className="h-3 bg-gray-800 rounded w-24" />
                </div>
                <div className="h-6 bg-gray-800 rounded w-16" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-gray-900/60 border-gray-800">
          <div className="divide-y divide-gray-800">
            {data?.protocols.map((protocol) => (
              <div
                key={protocol.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors"
              >
                {/* Health Score */}
                <HealthBadge score={protocol.healthScore} />

                {/* Protocol Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate">
                      {protocol.name}
                    </h3>
                    <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded">
                      {protocol.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      {protocol.tvlChange7d > 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-400" />
                      )}
                      {protocol.tvlChange7d > 0 ? "+" : ""}
                      {protocol.tvlChange7d.toFixed(1)}%
                    </span>
                    <span>TVL: {formatCurrency(protocol.tvl)}</span>
                    <span>Volume: {protocol.dominanceScore.toFixed(1)}%</span>
                  </div>
                  <AuditBadge status={protocol.auditStatus} />
                  {protocol.riskFactors.length > 0 && (
                    <RiskFactorList factors={protocol.riskFactors} />
                  )}
                  {protocol.warning && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{protocol.warning}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
