"use client";

// src/components/hubs/SmartMoneyHub.tsx
// Smart Money Leaderboard, Whale Intent Signals, & 1-Click Copy-Trading Engine.

import { useState, useEffect } from "react";
import { Fish, Zap, ShieldCheck, TrendingUp, ExternalLink, RefreshCw, Sparkles, Award, ArrowUpRight } from "lucide-react";
import { NeonCard } from "@/components/ui/NeonCard";
import SwapModal from "@/components/ui/SwapModal";
import ShareOnWarpcastButton from "@/components/ui/ShareOnWarpcastButton";
import type { TargetTokenParam, CopyTradeContext } from "@/components/hubs/SwapHub";
import type { SmartMoneySignal } from "@/app/api/whales/signals/route";

function getSignalBadge(type: SmartMoneySignal["signalType"]) {
  switch (type) {
    case "GEM_SNIPE":
      return { label: "💎 GEM SNIPE", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
    case "ACCUMULATION":
      return { label: "📈 ACCUMULATION", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
    case "YIELD_ROTATION":
      return { label: "🔄 YIELD ROTATION", color: "bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30" };
    default:
      return { label: "🔴 DUMPING", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
  }
}

export default function SmartMoneyHub() {
  const [signals, setSignals] = useState<SmartMoneySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [targetToken, setTargetToken] = useState<TargetTokenParam | undefined>();
  const [copyContext, setCopyContext] = useState<CopyTradeContext | undefined>();

  const handleCopyTrade = (sig: SmartMoneySignal) => {
    setTargetToken({
      address: sig.tokenAddress,
      symbol: sig.tokenSymbol,
      name: sig.tokenSymbol,
    });
    setCopyContext({
      walletLabel: sig.walletLabel,
      walletAddress: sig.wallet,
      winRate: sig.winRate,
      amountUSD: sig.usdValue,
      signalType: sig.signalType,
      protocol: sig.protocol,
    });
    setIsSwapOpen(true);
  };

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whales/signals");
      const json = await res.json();
      if (json.success) {
        setSignals(json.signals);
      }
    } catch (err) {
      console.error("Failed to fetch smart money signals", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="rounded-2xl border border-[#00d4ff]/30 bg-gradient-to-r from-black/80 via-[#0a1128]/70 to-black/80 p-5 sm:p-6 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-xs font-semibold text-[var(--bf-neon-primary)]">
              <Fish size={14} className="animate-pulse" />
              <span>Smart Money & Copy-Trading</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              Base Whale Copy-Trading & Signals
              <Sparkles size={18} className="text-amber-400" />
            </h2>
            <p className="text-xs sm:text-sm text-[var(--bf-text-secondary)]">
              Track top-performing Base whales (80%+ win rates) and execute <strong className="text-emerald-400">1-Click Copy Swaps</strong> instantly.
            </p>
          </div>

          <button
            onClick={fetchSignals}
            disabled={loading}
            className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-[var(--bf-neon-primary)] transition-all disabled:opacity-50"
            aria-label="Refresh signals"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div>
            <div className="text-gray-400 uppercase font-mono text-[10px]">Avg Whale Win-Rate</div>
            <div className="text-base font-bold text-emerald-400 font-mono">85.3%</div>
          </div>
          <div>
            <div className="text-gray-400 uppercase font-mono text-[10px]">24h Whale Inflow</div>
            <div className="text-base font-bold text-white font-mono">$330,100</div>
          </div>
          <div>
            <div className="text-gray-400 uppercase font-mono text-[10px]">Top Signal</div>
            <div className="text-base font-bold text-purple-400 font-mono flex items-center gap-1">
              <span>💎 GEM SNIPE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signals List */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Award size={18} className="text-[var(--bf-neon-primary)]" />
          <span>Live Smart Money Movements</span>
        </h3>

        {loading && signals.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw size={18} className="animate-spin text-[var(--bf-neon-primary)]" />
            <span>Tracking whale wallet logs...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {signals.map((sig) => {
              const badge = getSignalBadge(sig.signalType);
              return (
                <NeonCard key={sig.id} glowColor="rgba(0,212,255,0.06)" className="!p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                    {/* Wallet & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff]/20 to-emerald-500/20 border border-[#00d4ff]/30 flex items-center justify-center text-[var(--bf-neon-primary)] shrink-0">
                        <Fish size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{sig.walletLabel}</span>
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-emerald-400 font-semibold">
                            {sig.winRate}% Win-Rate
                          </span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                          <span className="font-mono">{sig.wallet.slice(0, 6)}…{sig.wallet.slice(-4)}</span>
                          <span>•</span>
                          <span>Bought <strong className="text-white font-mono">${sig.tokenSymbol}</strong> via {sig.protocol}</span>
                          <span>•</span>
                          <span>{sig.timeAgo}</span>
                        </div>
                      </div>
                    </div>

                    {/* Value & Copy Trade CTA */}
                    <div className="flex items-center gap-3 shrink-0 justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 flex-wrap">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase font-mono">Trade Value</div>
                        <div className="text-base font-bold font-mono text-white">${sig.usdValue.toLocaleString()}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <ShareOnWarpcastButton
                          tokenSymbol={sig.tokenSymbol}
                          amountUSD={sig.usdValue}
                          winRate={sig.winRate}
                          signalType={sig.signalType}
                          protocol={sig.protocol}
                        />

                        <button
                          onClick={() => handleCopyTrade(sig)}
                          className="px-3.5 py-2 bg-gradient-to-r from-[#00d4ff] to-[#7b61ff] hover:opacity-90 text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                        >
                          <Zap size={14} className="fill-black" />
                          <span>⚡ Copy Swap</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </NeonCard>
              );
            })}
          </div>
        )}
      </div>

      {/* 1-Click Swap Popup Modal with pre-configured Target Token and Copy Context */}
      <SwapModal
        isOpen={isSwapOpen}
        onClose={() => setIsSwapOpen(false)}
        targetToken={targetToken}
        copyTradeContext={copyContext}
      />
    </div>
  );
}
