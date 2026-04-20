"use client";

// src/app/protocols/[slug]/ProtocolDetailClient.tsx
// Interactive client shell for the protocol detail page.

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Activity,
  DollarSign,
  BarChart3,
  AlertTriangle,
  Link as LinkIcon,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────

interface ProtocolData {
  id: string;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  logo?: string;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  tvlChange30d?: number;
  fees24h: number;
  feesAnnualized: number;
  revenue24h: number;
  apy?: number;
  dominanceScore: number;
  healthScore: number;
  riskScore: number;
  audits: number;
  auditLink?: string;
  auditStatus: string;
  oracles: string[];
  forkedFrom?: string[];
  riskFactors: string[];
  warning: string | null;
}

interface RiskPoint {
  date: string;
  healthScore: number;
  tvl: number;
  timestamp: number;
}

interface WhaleEvent {
  txHash: string;
  action: string;
  usdValue: number;
  wallet: string;
  netFlowDirection: string;
  timestamp: number;
}

interface DetailResponse {
  protocol: ProtocolData;
  tvlHistory: { date: string; tvl: number }[];
  riskHistory: RiskPoint[];
  whaleActivity: WhaleEvent[];
  timestamp: number;
}

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

function grade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function gradeColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-blue-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Sub-components ───────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  color = "emerald",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: "emerald" | "blue" | "red";
}) {
  const colorMap = { emerald: "text-emerald-400", blue: "text-blue-400", red: "text-red-400" };
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${colorMap[color]}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────

export function ProtocolDetailClient({ data }: { data: DetailResponse }) {
  const router = useRouter();
  const p = data.protocol;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white pb-12">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-emerald-500/20">
        <div className="p-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-emerald-400" />
          </button>
          {p.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logo} alt={p.name} className="h-7 w-7 rounded-full" />
          )}
          <div className="flex-1">
            <h1 className="text-lg sm:text-2xl font-bold">{p.name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="px-1.5 py-0.5 rounded bg-gray-800">{p.category}</span>
              <span>&middot;</span>
              <span>{p.chains.join(", ")}</span>
              {p.forkedFrom && p.forkedFrom.length > 0 && (
                <>
                  <span>&middot;</span>
                  <span>Forked from {p.forkedFrom.join(", ")}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard icon={BarChart3} label="Total TVL" value={`$${fmt(p.tvl)}`} color="emerald" />
          <MetricCard
            icon={p.tvlChange24h >= 0 ? TrendingUp : TrendingDown}
            label="24h Change"
            value={`${p.tvlChange24h >= 0 ? "+" : ""}${p.tvlChange24h.toFixed(1)}%`}
            color={p.tvlChange24h >= 0 ? "emerald" : "red"}
          />
          <MetricCard
            icon={p.tvlChange7d >= 0 ? TrendingUp : TrendingDown}
            label="7d Change"
            value={`${p.tvlChange7d >= 0 ? "+" : ""}${p.tvlChange7d.toFixed(1)}%`}
            color={p.tvlChange7d >= 0 ? "emerald" : "red"}
          />
          {p.fees24h > 0 && (
            <MetricCard icon={DollarSign} label="Fees 24h" value={`$${fmt(p.fees24h)}`} color="blue" />
          )}
          {p.apy && p.fees24h === 0 && (
            <MetricCard icon={DollarSign} label="Avg APY" value={`${p.apy.toFixed(1)}%`} color="blue" />
          )}
        </div>

        {/* Health Score + Security */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Health Score</span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className={`text-3xl font-bold ${gradeColor(p.healthScore)}`}>
              {grade(p.healthScore)}{" "}
              <span className="text-base text-gray-500">({p.healthScore}/100)</span>
            </div>
            <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  p.healthScore >= 80 ? "bg-emerald-400" :
                  p.healthScore >= 65 ? "bg-blue-400" :
                  p.healthScore >= 50 ? "bg-yellow-400" : "bg-red-400"
                }`}
                style={{ width: `${p.healthScore}%` }}
              />
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Security</span>
              {p.auditStatus === "audited" ? (
                <Shield className="h-4 w-4 text-emerald-400" />
              ) : p.auditStatus === "partial" ? (
                <Activity className="h-4 w-4 text-yellow-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Audit Status</span>
                <span className="text-white capitalize">{p.auditStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Audits</span>
                <span className="text-white">{p.audits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Oracles</span>
                <span className="text-white">{p.oracles.length > 0 ? p.oracles.join(", ") : "None"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Factors */}
        {p.riskFactors.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={`h-4 w-4 ${p.warning === "HIGH" ? "text-red-400" : "text-yellow-400"}`} />
              <span className="text-sm font-medium">Risk Factors ({p.riskFactors.length})</span>
              {p.warning && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.warning === "HIGH" ? "bg-red-900/50 text-red-400" : "bg-blue-900/50 text-blue-400"
                }`}>
                  {p.warning}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.riskFactors.map((f) => (
                <span key={f} className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Risk Score History */}
        {data.riskHistory.length > 1 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              Health Score History
              <span className="text-xs text-gray-500 ml-auto">{data.riskHistory.length} points</span>
            </h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.riskHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, "Health Score"]}
                    labelFormatter={(label: string) => new Date(label).toLocaleString()}
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="healthScore"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TVL Chart */}
        {data.tvlHistory.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3">Base Chain TVL History</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.tvlHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveEnd"
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${fmt(v)}`}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${fmt(value)}`, "TVL"]}
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tvl"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#6366f1" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Whale Activity */}
        {data.whaleActivity.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-400" />
              Recent Whale Activity
            </h2>
            <div className="space-y-2">
              {data.whaleActivity.map((w) => (
                <div key={w.txHash} className="flex items-center justify-between text-sm py-2 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {w.netFlowDirection === "in" ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div>
                      <span className="capitalize text-gray-300">{w.action}</span>
                      <span className="text-gray-500 ml-2 text-xs">{shortAddr(w.wallet)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${w.netFlowDirection === "in" ? "text-emerald-400" : "text-red-400"}`}>
                      ${fmt(w.usdValue)}
                    </div>
                    <div className="text-xs text-gray-500">{relTime(w.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Link */}
        {p.auditLink && (
          <a
            href={p.auditLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <LinkIcon className="h-4 w-4" />
            View Audit Report
          </a>
        )}
      </div>
    </div>
  );
}
