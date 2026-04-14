// src/components/sections/WhalesSection.tsx
// Smart Money Cockpit — the best whale tracker on Base.
// Features: intent classification, whale scores, smart labels,
// hot signals, AI summary, animated scanning empty state.

"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  Filter,
  Clock,
  ArrowRightLeft,
  Sparkles,
  Zap,
  Search,
  Eye,
  ExternalLink,
  Target,
  Users,
  BarChart3,
  TrendingUp,
  Copy,
  Check,
} from "lucide-react";
import { MetricSkeleton, CircleRowSkeleton } from "@/components/ui/Skeleton";
import { NeonCard } from "@/components/ui/NeonCard";
import { RiskRing } from "@/components/ui/RiskRing";
import { CountUp } from "@/components/ui/CountUp";

// ─── Types ────────────────────────────────────────────────────

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  value: string;
  valueUSD: number;
  timestamp: string;
  type: string;
  tokenSymbol?: string;
  protocol?: string;
  blockNumber?: number;
  intent: string;
  intentLabel: string;
  intentColor: string;
  intentConfidence: number;
  whaleScore?: number;
}

interface WhaleProfile {
  address: string;
  score: number;
  txCount: number;
  totalVolume: number;
  protocols: string[];
  lastSeen: string;
  label?: string;
}

interface HotSignal {
  id: string;
  type: string;
  description: string;
  confidence: number;
  transactions: string[];
}

interface ApiResponse {
  whales: WhaleTransaction[];
  whaleProfiles?: WhaleProfile[];
  hotSignals?: HotSignal[];
  summary: {
    total: number;
    largest: number;
    avgSize: number;
    types: Record<string, number>;
    activeWhales?: number;
    totalVolumeUSD?: number;
  };
  source?: string;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────

const BASESCAN_TX = "https://basescan.org/tx";
const BASESCAN_ADDR = "https://basescan.org/address";

const THRESHOLDS = [
  { label: "$5K", value: 5000 },
  { label: "$10K", value: 10000 },
  { label: "$25K", value: 25000 },
  { label: "$50K", value: 50000 },
  { label: "$100K", value: 100000 },
];

const TIME_WINDOWS = [
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "4h", minutes: 240 },
  { label: "24h", minutes: 1440 },
];

const INTENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  accumulation: ArrowDownRight,
  distribution: ArrowUpRight,
  lp_entry: ArrowDownRight,
  lp_exit: ArrowUpRight,
  leverage: TrendingUp,
  deleverage: ArrowUpRight,
  arbitrage: Zap,
  transfer: ArrowRightLeft,
};

// ─── Helpers ──────────────────────────────────────────────────

function formatUSD(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function generateAISummary(whales: WhaleTransaction[], profiles: WhaleProfile[]): string {
  if (whales.length === 0) return "No whale activity detected in the current time window. Monitoring Base chain protocols...";

  const totalVol = whales.reduce((s, w) => s + w.valueUSD, 0);
  const intents = new Set(whales.map((w) => w.intent));
  const topProtocol = Object.entries(
    whales.reduce<Record<string, number>>((acc, w) => {
      if (w.protocol) acc[w.protocol] = (acc[w.protocol] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const parts: string[] = [];

  if (totalVol > 1000000) {
    parts.push(`${formatUSD(totalVol)} moved in ${whales.length} txs`);
  }

  if (intents.has("accumulation")) {
    const accCount = whales.filter((w) => w.intent === "accumulation").length;
    parts.push(`${accCount} accumulation${accCount > 1 ? "s" : ""} detected`);
  }

  if (intents.has("arbitrage")) {
    parts.push("possible arb activity");
  }

  if (intents.has("lp_exit")) {
    parts.push("⚠ LP exits spotted");
  }

  if (profiles.length > 0 && profiles[0].score >= 70) {
    const top = profiles[0];
    parts.push(`top whale ${top.label ? `"${top.label}"` : shortAddr(top.address)} (score ${top.score}) active`);
  }

  if (topProtocol) {
    parts.push(`hottest: ${topProtocol[0]} (${topProtocol[1]} txs)`);
  }

  return parts.length > 0 ? parts.join(" · ") : `${whales.length} whale flows detected across ${profiles.length} wallets`;
}

// ─── Animated Empty State ─────────────────────────────────────

function ScanningEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 px-4"
    >
      {/* Glowing whale SVG */}
      <motion.div
        animate={{
          y: [0, -10, 0],
          filter: [
            "drop-shadow(0 0 8px rgba(0,212,255,0.3))",
            "drop-shadow(0 0 24px rgba(0,212,255,0.7))",
            "drop-shadow(0 0 8px rgba(0,212,255,0.3))",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-6"
      >
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
          {/* Whale body */}
          <path
            d="M18 48C18 36 28 22 48 22C64 22 74 30 76 42C77 46 75 50 70 52C65 54 56 52 52 52C42 52 32 54 24 52C18 50 18 48 18 48Z"
            fill="rgba(0,212,255,0.08)"
            stroke="var(--bf-neon-primary)"
            strokeWidth="1.5"
          />
          {/* Eye */}
          <motion.circle cx="64" cy="38" r="3" fill="var(--bf-neon-primary)" animate={{ r: [2.5, 3.5, 2.5] }} transition={{ duration: 2, repeat: Infinity }} />
          {/* Tail fin */}
          <path d="M20 44C14 40 8 34 10 28C12 22 18 30 20 34C22 38 20 44 20 44Z" fill="rgba(0,212,255,0.08)" stroke="var(--bf-neon-primary)" strokeWidth="1.5" />
          <path d="M20 52C14 56 8 62 10 68C12 74 18 66 20 62C22 58 20 52 20 52Z" fill="rgba(0,212,255,0.08)" stroke="var(--bf-neon-primary)" strokeWidth="1.5" />
          {/* Ripple rings */}
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx="44"
              cy="60"
              r={8 + i * 6}
              stroke="var(--bf-neon-primary)"
              strokeWidth="0.5"
              fill="none"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.2, 1.5] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
            />
          ))}
        </svg>
      </motion.div>

      <motion.p
        className="neon-text font-mono text-sm mb-1"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Scanning for whales...
      </motion.p>
      <p className="text-[var(--bf-text-secondary)] text-xs text-center max-w-xs">
        Monitoring DEXes and lending protocols on Base for smart money flows
      </p>

      {/* Pulse dots */}
      <div className="flex items-center gap-2 mt-5">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--bf-neon-primary)]"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── AI Summary Terminal ──────────────────────────────────────

function AISummary({ summary }: { summary: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <NeonCard glowColor="rgba(0,255,136,0.06)" className="!border-[var(--bf-neon-secondary)]/10 !p-3" hoverScale={1}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-[var(--bf-neon-secondary)]" />
        <span className="text-[10px] text-[var(--bf-neon-secondary)] uppercase tracking-wider font-bold">AI Summary</span>
        <button
          onClick={handleCopy}
          className="ml-auto p-1 hover:bg-white/5 rounded transition-colors text-[var(--bf-text-muted)] hover:text-[var(--bf-text-primary)]"
          title="Copy summary"
        >
          {copied ? <Check className="h-3 w-3 text-[var(--bf-neon-secondary)]" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <div className="terminal text-xs leading-relaxed">
        <span className="text-[var(--bf-neon-secondary)]/50">$</span> {summary}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="inline-block w-2 h-4 bg-[var(--bf-neon-secondary)] ml-1 align-middle"
        />
      </div>
    </NeonCard>
  );
}

// ─── Hot Signals ──────────────────────────────────────────────

function HotSignals({ signals }: { signals: HotSignal[] }) {
  if (signals.length === 0) return null;

  const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; glow: string }> = {
    accumulation: { icon: TrendingUp, color: "status-ok", glow: "rgba(0,255,136,0.1)" },
    distribution: { icon: ArrowUpRight, color: "status-danger", glow: "rgba(255,45,123,0.1)" },
    arb_detected: { icon: Zap, color: "text-[var(--bf-neon-accent)]", glow: "rgba(123,97,255,0.1)" },
    whale_repeat: { icon: Target, color: "text-[var(--bf-status-warn)]", glow: "rgba(255,170,0,0.1)" },
  };

  return (
    <NeonCard glowColor="rgba(255,45,123,0.08)" className="!border-[var(--bf-neon-magenta)]/15" hoverScale={1}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-[var(--bf-neon-magenta)]" />
        <h3 className="text-xs font-bold neon-text-red">Hot Signals</h3>
        <span className="ml-auto text-[10px] text-[var(--bf-text-muted)] font-mono">{signals.length}</span>
      </div>
      <div className="space-y-1.5">
        {signals.map((s) => {
          const cfg = typeConfig[s.type] || typeConfig.whale_repeat;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5 hover:border-[var(--bf-neon-magenta)]/20 transition-colors"
            >
              <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-[var(--bf-text-primary)] truncate">{s.description}</p>
                <p className="text-[9px] text-[var(--bf-text-muted)] capitalize">{s.type} · {(s.confidence * 100).toFixed(0)}%</p>
              </div>
              <div className="text-[9px] text-[var(--bf-text-muted)] font-mono">{s.transactions.length}tx</div>
            </motion.div>
          );
        })}
      </div>
    </NeonCard>
  );
}

// ─── Top Whales Sidebar ──────────────────────────────────────

function TopWhales({ profiles }: { profiles: WhaleProfile[] }) {
  if (profiles.length === 0) return null;

  return (
    <NeonCard glowColor="rgba(123,97,255,0.06)" className="!border-[var(--bf-neon-accent)]/10" hoverScale={1}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-3.5 w-3.5 text-[var(--bf-neon-accent)]" />
        <h3 className="text-xs font-bold" style={{ color: "var(--bf-neon-accent)" }}>Top Whales</h3>
      </div>
      <div className="space-y-2">
        {profiles.slice(0, 5).map((p) => (
          <div key={p.address} className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
            <RiskRing score={p.score} size={36} strokeWidth={2.5} />
            <div className="flex-1 min-w-0">
              <a
                href={`${BASESCAN_ADDR}/${p.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-[var(--bf-text-primary)] hover:text-[var(--bf-neon-primary)] transition-colors truncate block"
              >
                {p.label || shortAddr(p.address)}
                <ExternalLink className="h-2.5 w-2.5 inline ml-0.5 opacity-40" />
              </a>
              <p className="text-[9px] text-[var(--bf-text-muted)]">
                {p.txCount} tx · {formatUSD(p.totalVolume)} · {p.protocols.length} proto
              </p>
            </div>
          </div>
        ))}
      </div>
    </NeonCard>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function WhalesSection() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterIntent, setFilterIntent] = useState("all");
  const [threshold, setThreshold] = useState(10000);
  const [timeWindow, setTimeWindow] = useState(60);
  const [searchAddr, setSearchAddr] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback((minUSD: number) => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/whales?min=${minUSD}&limit=200`)
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setIsLoading(false); setError(null); })
      .catch((e) => { setError(e.message); setIsLoading(false); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/whales?min=${threshold}&limit=200`)
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [threshold]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData(threshold), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [threshold, fetchData]);

  const handleRefresh = () => fetchData(threshold);

  // AI summary (regenerates when data changes)
  const aiSummary = useMemo(() => {
    if (!data?.whales || data.whales.length === 0) return null;
    return generateAISummary(data.whales, data?.whaleProfiles || []);
  }, [data?.whales, data?.whaleProfiles]);

  // Filtered transactions
  const filteredWhales = useMemo(() => {
    let list = data?.whales || [];
    if (filterType !== "all") list = list.filter((w) => w.type === filterType);
    if (filterIntent !== "all") list = list.filter((w) => w.intent === filterIntent);
    if (searchAddr.trim()) {
      const q = searchAddr.toLowerCase();
      list = list.filter((w) => w.from.toLowerCase().includes(q) || w.to.toLowerCase().includes(q));
    }
    return list;
  }, [data?.whales, filterType, filterIntent, searchAddr]);

  // Unique intent types for filter
  const uniqueIntents = useMemo(() => {
    if (!data?.whales) return [];
    const seen = new Set<string>();
    return data.whales.filter((w) => {
      if (seen.has(w.intent)) return false;
      seen.add(w.intent);
      return true;
    }).map((w) => ({ intent: w.intent, label: w.intentLabel, color: w.intentColor }));
  }, [data?.whales]);

  if (error && !data) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold gradient-text">Whale Tracker</h2>
        <NeonCard className="flex flex-col items-center justify-center py-12 !border-[var(--bf-neon-magenta)]/20">
          <AlertCircle className="h-6 w-6 text-[var(--bf-neon-magenta)] mb-3" />
          <p className="status-danger font-medium mb-1">Whale data unavailable</p>
          <p className="text-xs text-[var(--bf-text-secondary)] mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 text-xs bg-[var(--bf-neon-primary)]/10 hover:bg-[var(--bf-neon-primary)]/20 border border-[var(--bf-neon-primary)]/30 rounded-lg transition-colors neon-text font-medium">
            Retry
          </button>
        </NeonCard>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="whales-heading">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="whales-heading" className="text-2xl sm:text-3xl font-bold gradient-text">
            Smart Money Cockpit
          </h2>
          <p className="text-sm text-[var(--bf-text-secondary)] mt-0.5">
            Real-time whale tracking with intent classification across Base protocols
          </p>
        </div>
        <button onClick={handleRefresh} disabled={isLoading} className="p-2 bg-black/40 hover:bg-black/60 border border-[var(--bf-neon-primary)]/30 rounded-xl transition-all text-[var(--bf-neon-primary)] disabled:opacity-50 flex-shrink-0" aria-label="Refresh">
          <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Threshold */}
        <div className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-[var(--bf-text-muted)]" />
          <span className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider font-bold">Min</span>
          {THRESHOLDS.map((t) => (
            <button
              key={t.value}
              onClick={() => setThreshold(t.value)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all font-bold ${
                threshold === t.value
                  ? "bg-[var(--bf-neon-primary)]/20 text-[var(--bf-neon-primary)] border border-[var(--bf-neon-primary)]/40 neon-glow-sm"
                  : "bg-black/30 text-[var(--bf-text-muted)] border border-white/5 hover:text-[var(--bf-neon-primary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Time window */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Clock className="h-3.5 w-3.5 text-[var(--bf-text-muted)]" />
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.minutes}
              onClick={() => setTimeWindow(tw.minutes)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all font-bold ${
                timeWindow === tw.minutes
                  ? "bg-[var(--bf-neon-accent)]/20 text-[var(--bf-neon-accent)] border border-[var(--bf-neon-accent)]/40"
                  : "bg-black/30 text-[var(--bf-text-muted)] border border-white/5 hover:text-[var(--bf-neon-accent)]"
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics */}
      {isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <NeonCard key={i} hoverScale={1} className="!p-4"><MetricSkeleton /></NeonCard>)}
        </div>
      ) : data?.summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <NeonCard glowColor="rgba(0,212,255,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
            <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Total Flows</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums neon-text">
              <CountUp value={data.summary.total} />
            </p>
          </NeonCard>
          <NeonCard glowColor="rgba(123,97,255,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
            <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Largest</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums" style={{ color: "var(--bf-neon-accent)" }}>
              <CountUp value={data.summary.largest} prefix="$" />
            </p>
          </NeonCard>
          <NeonCard glowColor="rgba(0,255,136,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
            <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Avg Size</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums status-ok">
              <CountUp value={data.summary.avgSize} prefix="$" />
            </p>
          </NeonCard>
          <NeonCard glowColor="rgba(255,170,0,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
            <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Active Whales</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums status-warn">
              <CountUp value={data.summary.activeWhales || 0} />
            </p>
          </NeonCard>
        </div>
      ) : null}

      {/* AI Summary */}
      {aiSummary && <AISummary summary={aiSummary} />}

      {/* Main content: feed + sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Feed */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Intent + type filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[var(--bf-text-muted)] flex-shrink-0" />
            {/* Type filter */}
            {data?.summary.types && Object.keys(data.summary.types).length > 0 && (
              <>
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all font-bold ${
                    filterType === "all"
                      ? "bg-[var(--bf-neon-primary)]/15 text-[var(--bf-neon-primary)] border border-[var(--bf-neon-primary)]/30"
                      : "bg-black/30 text-[var(--bf-text-muted)] border border-white/5 hover:text-[var(--bf-neon-primary)]"
                  }`}
                >
                  All ({data.summary.total})
                </button>
                {Object.entries(data.summary.types).map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all font-bold ${
                      filterType === type
                        ? "bg-[var(--bf-neon-primary)]/15 text-[var(--bf-neon-primary)] border border-[var(--bf-neon-primary)]/30"
                        : "bg-black/30 text-[var(--bf-text-muted)] border border-white/5 hover:text-[var(--bf-neon-primary)]"
                    }`}
                  >
                    {type} ({count})
                  </button>
                ))}
              </>
            )}
            {/* Intent filter */}
            {uniqueIntents.length > 0 && (
              <div className="ml-2 flex items-center gap-1">
                <span className="text-[10px] text-[var(--bf-text-muted)]">Intent:</span>
                <button
                  onClick={() => setFilterIntent("all")}
                  className={`px-2 py-0.5 text-[9px] font-mono rounded transition-all ${
                    filterIntent === "all"
                      ? "bg-white/10 text-white border border-white/20"
                      : "bg-black/30 text-[var(--bf-text-muted)] border border-white/5 hover:text-white"
                  }`}
                >
                  All
                </button>
                {uniqueIntents.map(({ intent, label, color }) => (
                  <button
                    key={intent}
                    onClick={() => setFilterIntent(intent)}
                    className={`px-2 py-0.5 text-[9px] font-mono rounded transition-all border ${
                      filterIntent === intent
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-black/30 text-[var(--bf-text-muted)] border-white/5 hover:text-white"
                    }`}
                    style={{ color: filterIntent === intent ? "#fff" : color }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Transaction list */}
          <NeonCard className="!p-0 overflow-hidden" hoverScale={1}>
            {isLoading && !data ? (
              <div className="p-6"><CircleRowSkeleton rows={5} /></div>
            ) : filteredWhales.length === 0 ? (
              data?.whales.length === 0 && !isLoading ? (
                <ScanningEmpty />
              ) : (
                <div className="py-16 text-center">
                  <Eye className="h-8 w-8 text-[var(--bf-text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--bf-text-secondary)] font-medium">No matching transactions</p>
                  <p className="text-xs text-[var(--bf-text-muted)] mt-1">Try adjusting filters or lowering the threshold</p>
                </div>
              )
            ) : (
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                <AnimatePresence>
                  {filteredWhales.slice(0, 50).map((w, i) => {
                    const Icon = INTENT_ICONS[w.intent] || ArrowRightLeft;
                    return (
                      <motion.div
                        key={w.hash}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.5) }}
                        className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Icon */}
                        <div className={`p-1.5 rounded-lg flex-shrink-0`} style={{ backgroundColor: `${w.intentColor}15` }}>
                          <span style={{ color: w.intentColor }}><Icon className="h-4 w-4" /></span>
                        </div>

                        {/* Intent + protocol */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-bold uppercase" style={{ color: w.intentColor }}>
                              {w.intentLabel}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: `${w.intentColor}15`, color: w.intentColor }}>
                              {(w.intentConfidence * 100).toFixed(0)}%
                            </span>
                            {w.protocol && (
                              <span className="text-[9px] text-[var(--bf-text-muted)] capitalize font-mono">
                                {w.protocol}
                              </span>
                            )}
                          </div>

                          {/* Addresses with labels */}
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--bf-text-muted)] group-hover:text-[var(--bf-neon-primary)] transition-colors">
                            <a
                              href={`${BASESCAN_ADDR}/${w.from}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center gap-0.5"
                            >
                              {w.fromLabel ? (
                                <span className="text-[var(--bf-neon-secondary)]">{w.fromLabel}</span>
                              ) : (
                                shortAddr(w.from)
                              )}
                              <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </a>
                            <span className="text-[var(--bf-text-muted)]/50">→</span>
                            <a
                              href={`${BASESCAN_ADDR}/${w.to}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center gap-0.5"
                            >
                              {w.toLabel ? (
                                <span className="text-[var(--bf-neon-secondary)]">{w.toLabel}</span>
                              ) : (
                                shortAddr(w.to)
                              )}
                              <ExternalLink className="h-2 w-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </a>
                          </div>
                        </div>

                        {/* Amount + whale score */}
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold font-mono tabular-nums ${w.valueUSD >= 100000 ? "status-warn" : "text-white"}`}>
                            {formatUSD(w.valueUSD)}
                          </p>
                          <p className="text-[10px] text-[var(--bf-text-muted)] font-mono">{w.value}</p>
                        </div>

                        {/* Whale score ring */}
                        {w.whaleScore && w.whaleScore >= 40 && (
                          <div className="hidden sm:block flex-shrink-0">
                            <RiskRing score={w.whaleScore} size={32} strokeWidth={2.5} showLabel={false} />
                          </div>
                        )}

                        {/* Time */}
                        <div className="text-right flex-shrink-0 hidden sm:block w-14">
                          <p className="text-[10px] text-[var(--bf-text-muted)] font-mono">{timeAgo(w.timestamp)}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Footer */}
            {data && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-white/5 bg-black/30">
                <p className="text-[10px] text-[var(--bf-text-muted)]">
                  Powered by {data.source === "envio-hypersync" ? "Envio HyperSync" : "Etherscan V2"} · Threshold {formatUSD(threshold)}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[var(--bf-text-muted)]">
                  <Clock className="h-3 w-3" />
                  {new Date(data.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </NeonCard>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
          <HotSignals signals={data?.hotSignals || []} />
          <TopWhales profiles={data?.whaleProfiles || []} />
        </div>
      </div>
    </section>
  );
}
