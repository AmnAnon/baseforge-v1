// src/components/portfolio/AirdropScorer.tsx
// Interactive Airdrop Eligibility Scorer & Wallet Intelligence Component.

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  Award,
  Share2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Flame,
  UserCheck,
  ChevronRight,
  Layers,
  ArrowUpRight,
  Copy,
  Check,
} from "lucide-react";
import { NeonCard } from "@/components/ui/NeonCard";
import { CountUp } from "@/components/ui/CountUp";
import type { AirdropEvaluation } from "@/lib/airdrop";

interface AirdropScorerProps {
  address: string;
  onRefresh?: () => void;
}

export default function AirdropScorer({ address, onRefresh }: AirdropScorerProps) {
  const [data, setData] = useState<AirdropEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklistFilter, setChecklistFilter] = useState<"all" | "completed" | "pending">("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);

    fetch(`/api/wallet/airdrop?address=${address}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to evaluate airdrop score");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Could not calculate airdrop score");
        setLoading(false);
      });
  }, [address]);

  const handleShare = () => {
    if (!data) return;
    const text = encodeURIComponent(data.shareable.warpcastText);
    window.open(`https://warpcast.com/~/compose?text=${text}`, "_blank");
  };

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.shareable.scoreCardText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <NeonCard glowColor="rgba(0, 212, 255, 0.15)" className="p-8 text-center animate-pulse">
          <div className="h-8 w-48 bg-slate-800 rounded mx-auto mb-4" />
          <div className="h-24 w-24 bg-slate-800 rounded-full mx-auto mb-4" />
          <div className="h-4 w-64 bg-slate-800 rounded mx-auto" />
        </NeonCard>
      </div>
    );
  }

  if (error || !data) {
    return (
      <NeonCard glowColor="rgba(239, 68, 68, 0.15)" className="p-6 text-center border-red-500/30">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-300 font-mono">{error || "Unable to load airdrop evaluation."}</p>
      </NeonCard>
    );
  }

  const tierColors: Record<string, { ring: string; badge: string; text: string; bg: string }> = {
    Diamond: { ring: "#06b6d4", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40", text: "text-cyan-400", bg: "from-cyan-500/20" },
    Platinum: { ring: "#10b981", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", text: "text-emerald-400", bg: "from-emerald-500/20" },
    Gold: { ring: "#f59e0b", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40", text: "text-amber-400", bg: "from-amber-500/20" },
    Silver: { ring: "#94a3b8", badge: "bg-slate-500/20 text-slate-300 border-slate-500/40", text: "text-slate-400", bg: "from-slate-500/20" },
    Bronze: { ring: "#f97316", badge: "bg-orange-500/20 text-orange-300 border-orange-500/40", text: "text-orange-400", bg: "from-orange-500/20" },
  };

  const currentTier = tierColors[data.tier] || tierColors.Bronze;

  const filteredChecklist = data.checklist.filter((item) => {
    if (checklistFilter === "completed") return item.status === "completed";
    if (checklistFilter === "pending") return item.status !== "completed";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ─── Hero Scorecard ────────────────────────────────────── */}
      <NeonCard glowColor="rgba(0, 212, 255, 0.15)" className="relative overflow-hidden p-6 md:p-8 bg-gradient-to-b from-slate-900/90 to-slate-950/90">
        <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-br ${currentTier.bg} to-transparent opacity-30 blur-3xl pointer-events-none`} />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Column: Radial Score + Tier */}
          <div className="flex items-center gap-6">
            <div className="relative flex items-center justify-center">
              {/* SVG Radial Progress */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="54" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="54"
                  stroke={currentTier.ring}
                  strokeWidth="8"
                  strokeDasharray={339.292}
                  strokeDashoffset={339.292 - (339.292 * data.score) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  initial={{ strokeDashoffset: 339.292 }}
                  animate={{ strokeDashoffset: 339.292 - (339.292 * data.score) / 100 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  <CountUp value={data.score} />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">/ 100</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase tracking-wider border ${currentTier.badge}`}>
                  {data.tier} Tier
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
                  TOP {data.percentile}% ON BASE
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 font-mono">
                {data.estimatedAllocationTier} Allocation
              </h2>
              <p className="text-xs text-slate-400 font-mono max-w-sm">
                Sybil Resistance Score: <strong className="text-emerald-400">{data.sybilScore}% (Organic Trader)</strong>
              </p>
            </div>
          </div>

          {/* Right Column: CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold tracking-wider shadow-lg shadow-purple-500/20 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share on Warpcast
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-mono text-xs transition-all active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Summary"}
            </button>
          </div>
        </div>

        {/* Dimension Breakdown Progress Bars */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 pt-6 border-t border-slate-800/80">
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Volume</span>
              <span className="text-slate-200">{data.breakdown.volume.score}/25</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(data.breakdown.volume.score / 25) * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Activity</span>
              <span className="text-slate-200">{data.breakdown.activity.score}/20</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(data.breakdown.activity.score / 20) * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Protocols</span>
              <span className="text-slate-200">{data.breakdown.protocols.score}/25</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${(data.breakdown.protocols.score / 25) * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Bridge</span>
              <span className="text-slate-200">{data.breakdown.bridge.score}/15</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(data.breakdown.bridge.score / 15) * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Identity</span>
              <span className="text-slate-200">{data.breakdown.identity.score}/15</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(data.breakdown.identity.score / 15) * 100}%` }} />
            </div>
          </div>
        </div>
      </NeonCard>

      {/* ─── High-ROI Action Boosters ───────────────────────────── */}
      {data.boosters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold font-mono text-slate-200 uppercase tracking-wider">
              High-Impact Score Boosters
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.boosters.map((booster) => (
              <NeonCard
                key={booster.id}
                glowColor="none"
                className="p-4 bg-slate-900/60 border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      +{booster.potentialPoints} PTS
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{booster.costEstUSD}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-100 font-mono">{booster.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-mono">{booster.description}</p>
                </div>

                <a
                  href={booster.dappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-1.5 w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-mono font-semibold transition-all"
                >
                  Execute on {booster.protocol}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </NeonCard>
            ))}
          </div>
        </div>
      )}

      {/* ─── Two-Column: Protocol Heatmap & Criteria Checklist ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Protocol Interaction Matrix */}
        <NeonCard glowColor="none" className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Base Protocol Footprint
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {data.metrics.protocolCount} Active Protocols
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.protocols.map((proto) => (
              <div
                key={proto.slug}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  proto.status === "active"
                    ? "bg-emerald-950/20 border-emerald-800/40 text-slate-200"
                    : proto.status === "dormant"
                    ? "bg-amber-950/20 border-amber-800/40 text-slate-300"
                    : "bg-slate-900/40 border-slate-800/60 text-slate-500"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        proto.status === "active"
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                          : proto.status === "dormant"
                          ? "bg-amber-400"
                          : "bg-slate-600"
                      }`}
                    />
                    <span className="text-xs font-mono font-bold">{proto.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 block">{proto.category}</span>
                </div>

                <a
                  href={proto.dappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </NeonCard>

        {/* Right: Criteria Checklist */}
        <NeonCard glowColor="none" className="p-5 bg-slate-900/80 border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Eligibility Checklist
              </h3>
            </div>

            <div className="flex gap-1 text-[10px] font-mono">
              {(["all", "completed", "pending"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setChecklistFilter(f)}
                  className={`px-2 py-0.5 rounded capitalize ${
                    checklistFilter === f
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredChecklist.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : item.status === "partial" ? (
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-200 font-mono">{item.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono">{item.description}</p>
                    {item.progressText && (
                      <span className="inline-block text-[10px] font-mono text-cyan-400/90 font-medium">
                        Status: {item.progressText}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`text-xs font-mono font-bold ${
                      item.status === "completed"
                        ? "text-emerald-400"
                        : item.status === "partial"
                        ? "text-amber-400"
                        : "text-slate-500"
                    }`}
                  >
                    {item.points} / {item.maxPoints} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </NeonCard>
      </div>
    </div>
  );
}
