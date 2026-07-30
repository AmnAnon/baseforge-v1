"use client";

// src/components/hubs/MemecoinRadarHub.tsx
// Real-time Base Memecoin & New Token Launch Radar with RugCheck Safety Scores & 1-Click Buy.

import { useState, useEffect } from "react";
import { Rocket, ShieldAlert, ShieldCheck, Flame, ExternalLink, Zap, Lock, Unlock, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { NeonCard } from "@/components/ui/NeonCard";
import SwapModal from "@/components/ui/SwapModal";
import type { TokenLaunchItem } from "@/app/api/tokens/launches/route";

function getSafetyBadgeColor(score: number) {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (score >= 60) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-rose-500/10 text-rose-400 border-rose-500/30";
}

function getSafetyRingColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-rose-400";
}

export default function MemecoinRadarHub() {
  const [launches, setLaunches] = useState<TokenLaunchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDex, setSelectedDex] = useState<string>("all");
  const [highSafetyOnly, setHighSafetyOnly] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);

  const fetchLaunches = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/tokens/launches", window.location.origin);
      if (selectedDex !== "all") url.searchParams.set("dex", selectedDex);
      if (highSafetyOnly) url.searchParams.set("minSafety", "80");

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setLaunches(json.launches);
      }
    } catch (err) {
      console.error("Failed to fetch launches", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaunches();
    const interval = setInterval(fetchLaunches, 15000);
    return () => clearInterval(interval);
  }, [selectedDex, highSafetyOnly]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-2xl border border-[#00d4ff]/30 bg-gradient-to-r from-black/80 via-[#0a1128]/70 to-black/80 p-5 sm:p-6 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-xs font-semibold text-[var(--bf-neon-primary)]">
              <Rocket size={14} className="animate-pulse" />
              <span>Base Memecoin & Token Radar</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              Newly Launched Base Tokens
              <Sparkles size={18} className="text-amber-400" />
            </h2>
            <p className="text-xs sm:text-sm text-[var(--bf-text-secondary)]">
              Track real-time launches from <strong className="text-emerald-400">Clanker</strong>, <strong className="text-[#00d4ff]">Virtuals Protocol</strong>, and <strong className="text-purple-400">Aerodrome</strong> with instant RugCheck security scoring & 1-Click Buy.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchLaunches}
              disabled={loading}
              className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-[var(--bf-neon-primary)] transition-all disabled:opacity-50"
              aria-label="Refresh launches"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-400 mr-1 font-medium">Filter DEX:</span>
          {[
            { id: "all", label: "All DEXs" },
            { id: "clanker", label: "🔥 Clanker" },
            { id: "virtuals", label: "🤖 Virtuals AI" },
            { id: "aerodrome", label: "🚀 Aerodrome" },
            { id: "uniswap v3", label: "🦄 Uniswap V3" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedDex(btn.id)}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                selectedDex === btn.id
                  ? "bg-[var(--bf-neon-primary)]/20 border-[var(--bf-neon-primary)] text-white font-semibold shadow-[0_0_15px_rgba(0,212,255,0.2)]"
                  : "bg-black/40 border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {btn.label}
            </button>
          ))}

          <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

          <button
            onClick={() => setHighSafetyOnly(!highSafetyOnly)}
            className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
              highSafetyOnly
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-semibold"
                : "bg-black/40 border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            <ShieldCheck size={14} />
            <span>High Safety Score (&gt;80)</span>
          </button>
        </div>
      </div>

      {/* Launches Feed */}
      {loading && launches.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 flex items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin text-[var(--bf-neon-primary)]" />
          <span>Scanning Base block logs for new token launches...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {launches.map((item) => (
            <NeonCard key={item.id} glowColor="rgba(0,212,255,0.06)" className="!p-4 relative">
              <div className="space-y-3">
                {/* Token title row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff]/20 to-purple-500/20 border border-[#00d4ff]/30 flex items-center justify-center font-mono font-bold text-white">
                      {item.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{item.name}</h3>
                        <span className="text-xs font-mono text-[var(--bf-neon-primary)] font-semibold">
                          ${item.symbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300 font-medium">
                          {item.dex}
                        </span>
                        <span>•</span>
                        <span>{item.createdAgo}</span>
                      </div>
                    </div>
                  </div>

                  {/* RugCheck safety score ring */}
                  <div className="flex flex-col items-end">
                    <div className={`px-2.5 py-1 rounded-xl border text-xs font-bold font-mono flex items-center gap-1 ${getSafetyBadgeColor(item.rugCheck.safetyScore)}`}>
                      <ShieldCheck size={13} />
                      <span>{item.rugCheck.safetyScore}/100</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 mt-1">
                      Safety Score
                    </span>
                  </div>
                </div>

                {/* Market Stats Grid */}
                <div className="grid grid-cols-3 gap-2 bg-black/40 rounded-xl p-2.5 border border-white/5 text-xs">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Market Cap</div>
                    <div className="font-mono font-bold text-white">${item.currentMarketCap.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">24h Change</div>
                    <div className={`font-mono font-bold ${item.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {item.change24h >= 0 ? "+" : ""}{item.change24h}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">24h Volume</div>
                    <div className="font-mono font-bold text-white">${item.volume24h.toLocaleString()}</div>
                  </div>
                </div>

                {/* Security Flags */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  {item.rugCheck.flags.map((flag, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">
                      {flag}
                    </span>
                  ))}
                </div>

                {/* Quick Buy CTA */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <a
                    href={`https://basescan.org/token/${item.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <span>Basescan</span>
                    <ExternalLink size={12} />
                  </a>

                  <button
                    onClick={() => setIsSwapOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[#00d4ff] to-[#7b61ff] hover:opacity-90 text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                  >
                    <Zap size={14} className="fill-black" />
                    <span>⚡ Quick Buy / Swap</span>
                  </button>
                </div>
              </div>
            </NeonCard>
          ))}
        </div>
      )}

      {/* 1-Click Swap Popup Modal */}
      <SwapModal isOpen={isSwapOpen} onClose={() => setIsSwapOpen(false)} />
    </div>
  );
}
