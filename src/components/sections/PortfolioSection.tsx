// src/components/sections/PortfolioSection.tsx
// Portfolio Intelligence — self-custody portfolio tracker for Base.
// Features: multi-address management, protocol exposure, AI summary,
// concentration warnings, agent JSON export, cyber-neon glassmorphism.

"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Plus,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  PieChart,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Clock,
  Search,
  BarChart3,
} from "lucide-react";
import { MetricSkeleton } from "@/components/ui/Skeleton";
import { NeonCard } from "@/components/ui/NeonCard";
import { RiskRing } from "@/components/ui/RiskRing";
import { CountUp } from "@/components/ui/CountUp";
import WalletConnectButton from "@/components/ui/WalletConnectButton";

// ─── Types ────────────────────────────────────────────────────

interface PortfolioPosition {
  symbol: string;
  priceUsd: number;
  balance: string;
  valueUsd: number;
  category: string;
  change24h?: number;
  coingeckoId: string;
  allocationPct: number;
}

interface ProtocolExposure {
  protocol: string;
  valueUsd: number;
  pct: number;
}

interface RiskFlags {
  concentrationRisk: boolean;
  topAssetPct: number;
  stablecoinHeavy: boolean;
}

interface PortfolioSummary {
  totalUsdValue: number;
  positionCount: number;
  nativeBalance: string;
  topToken: string | null;
  stablecoinPct: number;
  ethDerivativePct: number;
  governancePct: number;
}

interface PortfolioResponse {
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
  protocolExposure: ProtocolExposure[];
  riskFlags: RiskFlags;
  timestamp: number;
  isStale: boolean;
}

interface SavedWallet {
  address: string;
  label?: string;
  addedAt: number;
}

// ─── Constants ────────────────────────────────────────────────

const BASESCAN_ADDR = "https://basescan.org/address";

const QUICK_WALLETS: { label: string; address: string }[] = [
  { label: "Coinbase 2", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { label: "Aerodrome", address: "0x77777777777112587558404cd7fd36a036b49b23" },
];

// ─── LocalStorage helpers ─────────────────────────────────────

const STORAGE_KEY = "baseforge_portfolio_wallets";

function loadWallets(): SavedWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWallets(wallets: SavedWallet[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────

function formatUSD(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// Compute overall portfolio risk score (0-100)
function computePortfolioRisk(positions: PortfolioPosition[], riskFlags: RiskFlags): number {
  let score = 50; // baseline

  // Diversification penalty
  if (riskFlags.concentrationRisk) score -= 20;
  if (riskFlags.topAssetPct > 90) score -= 10;

  // Stablecoin bonus (lower risk)
  if (riskFlags.stablecoinHeavy) score += 15;

  // Position count bonus
  score += Math.min(10, positions.length * 2);

  return Math.max(0, Math.min(100, score));
}

function generatePortfolioSummary(positions: PortfolioPosition[], summary: PortfolioSummary, riskFlags: RiskFlags): string {
  if (positions.length === 0) return "No holdings detected. This wallet appears empty on Base chain.";

  const parts: string[] = [];

  parts.push(`${formatUSD(summary.totalUsdValue)} across ${summary.positionCount} assets`);

  if (riskFlags.concentrationRisk) {
    parts.push(`⚠ ${summary.topToken} dominates at ${riskFlags.topAssetPct}%`);
  }

  if (riskFlags.stablecoinHeavy) {
    parts.push("heavy stablecoin allocation");
  }

  const gainers = positions.filter((p) => (p.change24h ?? 0) > 0);
  const losers = positions.filter((p) => (p.change24h ?? 0) < 0);

  if (gainers.length > 0) {
    const top = gainers.reduce((a, b) => (a.change24h ?? 0) > (b.change24h ?? 0) ? a : b);
    parts.push(`${top.symbol} +${top.change24h?.toFixed(1)}%`);
  }

  if (summary.ethDerivativePct > 50) {
    parts.push("ETH-heavy portfolio");
  }

  return parts.join(" · ");
}

// ─── Animated Empty State ─────────────────────────────────────

function PortfolioEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 px-4"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-6"
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="15" y="25" width="50" height="35" rx="6" fill="rgba(0,212,255,0.08)" stroke="var(--bf-neon-primary)" strokeWidth="1.5" />
          <rect x="22" y="32" width="36" height="3" rx="1.5" fill="rgba(0,212,255,0.3)" />
          <rect x="22" y="38" width="24" height="3" rx="1.5" fill="rgba(0,212,255,0.2)" />
          <rect x="22" y="44" width="30" height="3" rx="1.5" fill="rgba(0,212,255,0.15)" />
          <circle cx="55" cy="52" r="12" fill="rgba(0,212,255,0.08)" stroke="var(--bf-neon-primary)" strokeWidth="1.5" />
          <motion.path d="M51 52L54 55L59 49" stroke="var(--bf-neon-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }} />
        </svg>
      </motion.div>
      <p className="neon-text font-mono text-sm mb-1">No portfolio data</p>
      <p className="text-[var(--bf-text-secondary)] text-xs text-center max-w-xs">
        Enter a Base wallet address to view on-chain holdings tracked via Envio HyperSync
      </p>
    </motion.div>
  );
}

// ─── AI Summary Terminal ──────────────────────────────────────

function PortfolioSummaryTerminal({ summary, onRegenerate }: { summary: string; onRegenerate: () => void }) {
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
        <span className="text-[10px] text-[var(--bf-neon-secondary)] uppercase tracking-wider font-bold">Portfolio AI</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onRegenerate} className="p-1 hover:bg-white/5 rounded transition-colors text-[var(--bf-text-muted)] hover:text-[var(--bf-neon-secondary)]" title="Regenerate">
            <RotateCcw className="h-3 w-3" />
          </button>
          <button onClick={handleCopy} className="p-1 hover:bg-white/5 rounded transition-colors text-[var(--bf-text-muted)] hover:text-[var(--bf-text-primary)]" title="Copy">
            {copied ? <Check className="h-3 w-3 text-[var(--bf-neon-secondary)]" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <div className="terminal text-xs leading-relaxed">
        <span className="text-[var(--bf-neon-secondary)]/50">$</span> {summary}
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="inline-block w-2 h-4 bg-[var(--bf-neon-secondary)] ml-1 align-middle" />
      </div>
    </NeonCard>
  );
}

// ─── Protocol Exposure Bar Chart ──────────────────────────────

function ProtocolBars({ exposures }: { exposures: ProtocolExposure[] }) {
  if (exposures.length === 0) return null;
  const maxVal = Math.max(...exposures.map((e) => e.valueUsd));

  const colors = [
    "var(--bf-neon-primary)",
    "var(--bf-neon-secondary)",
    "var(--bf-neon-accent)",
    "var(--bf-status-warn)",
    "var(--bf-neon-magenta)",
    "var(--bf-neon-orange, #ff8c00)",
  ];

  return (
    <NeonCard glowColor="rgba(123,97,255,0.06)" className="!p-4" hoverScale={1}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-[var(--bf-neon-accent)]" />
        <h3 className="text-xs font-bold" style={{ color: "var(--bf-neon-accent)" }}>Protocol Exposure</h3>
      </div>
      <div className="space-y-2">
        {exposures.slice(0, 8).map((exp, i) => {
          const barWidth = maxVal > 0 ? (exp.valueUsd / maxVal) * 100 : 0;
          const color = colors[i % colors.length];
          return (
            <div key={exp.protocol} className="group">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-[var(--bf-text-secondary)] font-mono">{exp.protocol}</span>
                <span className="text-[10px] text-[var(--bf-text-muted)] font-mono">{exp.pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </NeonCard>
  );
}

// ─── Concentration Warnings ───────────────────────────────────

function RiskWarnings({ riskFlags, positions }: { riskFlags: RiskFlags; positions: PortfolioPosition[] }) {
  const warnings: { icon: React.ComponentType<{ className?: string }>; text: string; color: string }[] = [];

  if (riskFlags.concentrationRisk) {
    const top = positions[0];
    warnings.push({
      icon: AlertTriangle,
      text: `${top?.symbol} makes up ${riskFlags.topAssetPct}% of portfolio — high concentration`,
      color: "text-[var(--bf-neon-magenta)]",
    });
  }

  if (riskFlags.stablecoinHeavy) {
    warnings.push({
      icon: Shield,
      text: "Portfolio is >80% stablecoins — low growth exposure",
      color: "text-[var(--bf-status-warn)]",
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      icon: Shield,
      text: "Portfolio diversification looks healthy",
      color: "text-[var(--bf-neon-secondary)]",
    });
  }

  return (
    <div className="space-y-1.5">
      {warnings.map((w, i) => {
        const Icon = w.icon;
        return (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
            <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${w.color}`} />
            <p className={`text-[10px] font-mono ${w.color}`}>{w.text}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function PortfolioSection() {
  const [wallets, setWallets] = useState<SavedWallet[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [newAddress, setNewAddress] = useState("");
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSymbol, setSearchSymbol] = useState("");
  const [summarySeed, setSummarySeed] = useState(0);
  const [agentJsonCopied, setAgentJsonCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref so handleWalletConnected can call fetchData before it's defined
  const fetchDataRef = useRef<(addr: string) => void>(() => {});

  // Basename resolution — show human-readable name when available
  const [basename, setBasename] = useState<string | null>(null);

  useEffect(() => {
    const addr = wallets[activeIdx]?.address;
    if (!addr) { setBasename(null); return; }
    let cancelled = false;
    fetch(`https://api.basename.io/v1/resolve/${addr}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!cancelled && json?.name) setBasename(json.name as string);
        else if (!cancelled) setBasename(null);
      })
      .catch(() => { if (!cancelled) setBasename(null); });
    return () => { cancelled = true; };
  }, [wallets, activeIdx]);

  // Called by WalletConnectButton when the connected address changes
  const handleWalletConnected = useCallback((connectedAddress: string | null) => {
    if (!connectedAddress) return;
    const lower = connectedAddress.toLowerCase();
    setWallets((prev) => {
      if (prev.some((w) => w.address === lower)) {
        const idx = prev.findIndex((w) => w.address === lower);
        setActiveIdx(idx);
        fetchDataRef.current(lower);
        return prev;
      }
      const next = [...prev, { address: lower, label: "My Wallet", addedAt: Date.now() }];
      saveWallets(next);
      setActiveIdx(next.length - 1);
      fetchDataRef.current(lower);
      return next;
    });
  }, []);

  // Load wallets from localStorage on mount
  useEffect(() => {
    const loaded = loadWallets();
    setWallets(loaded);
    if (loaded.length > 0) {
      setActiveIdx(0);
      fetchData(loaded[0].address);
    }
  }, []);

  const activeAddress = wallets[activeIdx]?.address ?? "";

  const fetchData = useCallback((addr: string) => {
    if (!addr || !isValidAddress(addr)) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/portfolio?address=${addr}`)
      .then((r) => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setIsLoading(false); setError(null); })
      .catch((e) => { setError(e.message); setIsLoading(false); });
  }, []);

  // Keep ref in sync with latest fetchData
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!activeAddress) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData(activeAddress), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeAddress, fetchData]);

  // Add wallet
  const handleAddWallet = useCallback(() => {
    const addr = newAddress.trim();
    if (!isValidAddress(addr)) return;
    if (wallets.some((w) => w.address.toLowerCase() === addr.toLowerCase())) return;
    const next = [...wallets, { address: addr.toLowerCase(), addedAt: Date.now() }];
    setWallets(next);
    saveWallets(next);
    setActiveIdx(next.length - 1);
    setNewAddress("");
    fetchData(addr.toLowerCase());
  }, [newAddress, wallets, fetchData]);

  // Remove wallet
  const handleRemoveWallet = useCallback((idx: number) => {
    const next = wallets.filter((_, i) => i !== idx);
    setWallets(next);
    saveWallets(next);
    if (activeIdx >= next.length) setActiveIdx(Math.max(0, next.length - 1));
    else if (activeIdx > idx) setActiveIdx((a) => a - 1);
  }, [wallets, activeIdx]);

  // Quick wallet
  const handleQuickWallet = useCallback((addr: string) => {
    const lower = addr.toLowerCase();
    let idx = wallets.findIndex((w) => w.address === lower);
    if (idx === -1) {
      const next = [...wallets, { address: lower, label: QUICK_WALLETS.find((q) => q.address === addr)?.label, addedAt: Date.now() }];
      setWallets(next);
      saveWallets(next);
      idx = next.length - 1;
    }
    setActiveIdx(idx);
    fetchData(lower);
  }, [wallets, fetchData]);

  // AI summary
  const aiSummary = useMemo(() => {
    if (!data?.positions || data.positions.length === 0) return null;
    return generatePortfolioSummary(data.positions, data.summary, data.riskFlags);
  }, [data?.positions, data?.summary, data?.riskFlags, summarySeed]);

  // Filtered positions
  const filteredPositions = useMemo(() => {
    if (!data?.positions) return [];
    if (!searchSymbol.trim()) return data.positions;
    const q = searchSymbol.toLowerCase();
    return data.positions.filter((p) => p.symbol.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [data?.positions, searchSymbol]);

  // Portfolio risk score
  const portfolioRiskScore = useMemo(() => {
    if (!data) return null;
    return computePortfolioRisk(data.positions, data.riskFlags);
  }, [data]);

  // Copy as JSON
  const handleCopyJSON = useCallback(() => {
    if (!data) return;
    const payload = {
      _source: "BaseForge Portfolio Intelligence",
      _version: "1.0.0-beta.1",
      _timestamp: new Date().toISOString(),
      address: activeAddress,
      summary: data.summary,
      positions: data.positions,
      protocolExposure: data.protocolExposure,
      riskFlags: data.riskFlags,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
    setAgentJsonCopied(true);
    setTimeout(() => setAgentJsonCopied(false), 2000);
  }, [data, activeAddress]);

  const totalNetWorth = data?.summary.totalUsdValue ?? 0;
  const assetCount = data?.summary.positionCount ?? 0;
  const nativeEth = data?.summary.nativeBalance ?? "0";

  return (
    <section className="space-y-5" aria-labelledby="portfolio-heading">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="portfolio-heading" className="text-2xl sm:text-3xl font-bold gradient-text">
            Portfolio Intelligence
          </h2>
          <p className="text-sm text-[var(--bf-text-secondary)] mt-0.5">
            Self-custody portfolio tracking with on-chain Base holdings
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <WalletConnectButton onAddressChange={handleWalletConnected} />
          <button onClick={() => fetchData(activeAddress)} disabled={isLoading} className="p-2 bg-black/40 hover:bg-black/60 border border-[var(--bf-neon-primary)]/30 rounded-xl transition-all text-[var(--bf-neon-primary)] disabled:opacity-50" aria-label="Refresh">
            <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Wallet Management */}
      <NeonCard glowColor="rgba(0,212,255,0.06)" className="!p-3 sm:!p-4" hoverScale={1}>
        {/* Saved wallets */}
        {wallets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <Wallet className="h-3.5 w-3.5 text-[var(--bf-neon-primary)]" />
            <span className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider font-bold">Wallets</span>
            {wallets.map((w, i) => (
              <div key={w.address} className="relative group/w">
                <button
                  onClick={() => { setActiveIdx(i); fetchData(w.address); }}
                  className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all ${
                    i === activeIdx
                      ? "bg-[var(--bf-neon-primary)]/20 text-[var(--bf-neon-primary)] border border-[var(--bf-neon-primary)]/40 neon-glow-sm"
                      : "bg-black/30 text-[var(--bf-text-muted)] border border-white/5 hover:text-[var(--bf-neon-primary)]"
                  }`}
                >
                  {w.label || shortAddr(w.address)}
                </button>
                <button
                  onClick={() => handleRemoveWallet(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--bf-neon-magenta)]/80 text-white opacity-0 group-hover/w:opacity-100 transition-opacity flex items-center justify-center text-[8px] leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add wallet */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddWallet()}
              placeholder="0x... Base wallet address"
              className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-[var(--bf-text-primary)] placeholder:text-[var(--bf-text-muted)] focus:outline-none focus:border-[var(--bf-neon-primary)]/50 focus:ring-1 focus:ring-[var(--bf-neon-primary)]/20 transition-all"
            />
          </div>
          <button
            onClick={handleAddWallet}
            disabled={!isValidAddress(newAddress.trim())}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-[var(--bf-neon-primary)]/15 hover:bg-[var(--bf-neon-primary)]/25 border border-[var(--bf-neon-primary)]/30 rounded-lg transition-all text-[var(--bf-neon-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>

          {/* Quick wallets */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-[var(--bf-text-muted)]">Quick:</span>
            {QUICK_WALLETS.map((qw) => (
              <button
                key={qw.address}
                onClick={() => handleQuickWallet(qw.address)}
                className="px-2 py-1 text-[9px] font-mono bg-black/30 border border-white/5 rounded-md text-[var(--bf-text-muted)] hover:text-[var(--bf-neon-primary)] transition-colors"
              >
                {qw.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active address + Basename */}
        {activeAddress && (
          <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--bf-text-muted)]">
            <Search className="h-3 w-3" />
            <a href={`${BASESCAN_ADDR}/${activeAddress}`} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-[var(--bf-neon-primary)] transition-colors flex items-center gap-0.5">
              {activeAddress}
              <ExternalLink className="h-2.5 w-2.5 opacity-50" />
            </a>
            {basename && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--bf-neon-primary)]/10 text-[var(--bf-neon-primary)] border border-[var(--bf-neon-primary)]/20 text-[9px] font-medium">
                {basename}
              </span>
            )}
          </div>
        )}
      </NeonCard>

      {(!activeAddress && wallets.length === 0) ? (
        <PortfolioEmpty />
      ) : isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <NeonCard key={i} hoverScale={1} className="!p-4"><MetricSkeleton /></NeonCard>)}
        </div>
      ) : data ? (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <NeonCard glowColor="rgba(0,212,255,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
              <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Net Worth</p>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums neon-text">
                <CountUp value={totalNetWorth} prefix="$" />
              </p>
            </NeonCard>
            <NeonCard glowColor="rgba(123,97,255,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
              <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Assets</p>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums" style={{ color: "var(--bf-neon-accent)" }}>
                <CountUp value={assetCount} />
              </p>
            </NeonCard>
            <NeonCard glowColor="rgba(0,255,136,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
              <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">ETH Balance</p>
              <p className="text-lg sm:text-xl font-bold font-mono tabular-nums status-ok">
                {parseFloat(nativeEth).toFixed(4)}
              </p>
            </NeonCard>
            <NeonCard glowColor="rgba(255,170,0,0.06)" hoverScale={1} className="!p-3 sm:!p-4">
              <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider mb-1 font-bold">Risk Score</p>
              {portfolioRiskScore !== null ? (
                <div className="flex items-center gap-2">
                  <RiskRing score={portfolioRiskScore} size={40} strokeWidth={3} />
                  <span className={`text-lg font-bold font-mono ${
                    portfolioRiskScore >= 70 ? "status-ok" : portfolioRiskScore >= 40 ? "status-warn" : "status-danger"
                  }`}>{portfolioRiskScore}</span>
                </div>
              ) : (
                <span className="text-lg font-mono text-[var(--bf-text-muted)]">—</span>
              )}
            </NeonCard>
          </div>

          {/* AI Summary */}
          {aiSummary && <PortfolioSummaryTerminal summary={aiSummary} onRegenerate={() => setSummarySeed((s) => s + 1)} />}

          {/* Agent JSON + Warnings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Protocol Exposure */}
            {data.protocolExposure.length > 0 && <ProtocolBars exposures={data.protocolExposure} />}

            {/* Risk Warnings */}
            <NeonCard glowColor="rgba(255,45,123,0.06)" className="!p-4" hoverScale={1}>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-[var(--bf-neon-magenta)]" />
                <h3 className="text-xs font-bold" style={{ color: "var(--bf-neon-magenta)" }}>Risk Analysis</h3>
                <button
                  onClick={handleCopyJSON}
                  className="ml-auto flex items-center gap-1 px-2 py-1 text-[9px] font-mono bg-[var(--bf-neon-accent)]/10 hover:bg-[var(--bf-neon-accent)]/20 border border-[var(--bf-neon-accent)]/30 rounded transition-all text-[var(--bf-neon-accent)]"
                  title="Copy portfolio as JSON for AI agent"
                >
                  {agentJsonCopied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Agent JSON</>}
                </button>
              </div>
              <RiskWarnings riskFlags={data.riskFlags} positions={data.positions} />

              {/* Allocation breakdown */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider font-bold mb-2">Allocation Breakdown</p>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--bf-neon-primary)]" />
                    <span className="text-[var(--bf-text-muted)]">Stable</span>
                    <span className="text-[var(--bf-text-secondary)]">{data.summary.stablecoinPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--bf-neon-secondary)]" />
                    <span className="text-[var(--bf-text-muted)]">ETH</span>
                    <span className="text-[var(--bf-text-secondary)]">{data.summary.ethDerivativePct.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--bf-neon-accent)]" />
                    <span className="text-[var(--bf-text-muted)]">Gov</span>
                    <span className="text-[var(--bf-text-secondary)]">{data.summary.governancePct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </NeonCard>
          </div>

          {/* Asset Holdings */}
          <NeonCard className="!p-0 overflow-hidden" hoverScale={1}>
            {/* Search + filter */}
            <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-black/20">
              <Search className="h-3.5 w-3.5 text-[var(--bf-text-muted)]" />
              <input
                type="text"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                placeholder="Filter by symbol or category..."
                className="flex-1 bg-transparent text-xs font-mono text-[var(--bf-text-primary)] placeholder:text-[var(--bf-text-muted)] focus:outline-none"
              />
              <span className="text-[10px] text-[var(--bf-text-muted)] font-mono">{filteredPositions.length} holdings</span>
            </div>

            {/* Header row */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 bg-black/30 text-[10px] text-[var(--bf-text-muted)] uppercase tracking-wider font-bold">
              <div className="col-span-3">Asset</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Balance</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">24h</div>
              <div className="col-span-1 text-right">Alloc</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              <AnimatePresence>
                {filteredPositions.length === 0 ? (
                  <div className="py-12 text-center">
                    <PieChart className="h-8 w-8 text-[var(--bf-text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--bf-text-secondary)]">No matching assets</p>
                  </div>
                ) : (
                  filteredPositions.map((p, i) => (
                    <motion.div
                      key={p.symbol}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
                      className="grid grid-cols-12 gap-2 px-3 sm:px-4 py-3 hover:bg-white/[0.03] transition-colors group items-center"
                    >
                      {/* Asset */}
                      <div className="col-span-5 sm:col-span-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--bf-neon-primary)]/20 to-[var(--bf-neon-accent)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--bf-neon-primary)] flex-shrink-0 border border-white/10">
                          {p.symbol.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold font-mono text-[var(--bf-text-primary)] truncate">{p.symbol}</p>
                          <p className="text-[9px] text-[var(--bf-text-muted)] sm:hidden">{p.category}</p>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="col-span-2 hidden sm:block text-right">
                        <p className="text-xs font-mono text-[var(--bf-text-secondary)] tabular-nums">{formatUSD(p.priceUsd)}</p>
                      </div>

                      {/* Balance */}
                      <div className="col-span-3 sm:col-span-2 text-right">
                        <p className="text-xs font-mono text-[var(--bf-text-secondary)] tabular-nums truncate" title={p.balance}>
                          {parseFloat(p.balance).toFixed(p.priceUsd > 100 ? 2 : 4)}
                        </p>
                      </div>

                      {/* Value */}
                      <div className="col-span-2 text-right">
                        <p className="text-sm font-bold font-mono text-white tabular-nums">{formatUSD(p.valueUsd)}</p>
                      </div>

                      {/* 24h Change */}
                      <div className="col-span-2 hidden sm:block text-right">
                        {p.change24h !== undefined && p.change24h !== 0 ? (
                          <div className={`flex items-center justify-end gap-1 text-xs font-mono tabular-nums ${p.change24h >= 0 ? "status-ok" : "status-danger"}`}>
                            {p.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {p.change24h >= 0 ? "+" : ""}{p.change24h.toFixed(1)}%
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--bf-text-muted)]">—</span>
                        )}
                      </div>

                      {/* Allocation */}
                      <div className="col-span-1 text-right">
                        <p className="text-[10px] font-mono text-[var(--bf-text-muted)]">{p.allocationPct.toFixed(0)}%</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {data && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-white/5 bg-black/30">
                <p className="text-[10px] text-[var(--bf-text-muted)]">
                  Read-only · On-chain via viem multicall · {data.positions.length} assets tracked
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[var(--bf-text-muted)]">
                  <Clock className="h-3 w-3" />
                  {new Date(data.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </NeonCard>
        </>
      ) : error ? (
        <NeonCard className="flex flex-col items-center justify-center py-12 !border-[var(--bf-neon-magenta)]/20">
          <AlertTriangle className="h-6 w-6 text-[var(--bf-neon-magenta)] mb-3" />
          <p className="status-danger font-medium mb-1">Failed to fetch portfolio</p>
          <p className="text-xs text-[var(--bf-text-secondary)] mb-4">{error}</p>
          <button onClick={() => fetchData(activeAddress)} className="px-4 py-2 text-xs bg-[var(--bf-neon-primary)]/10 hover:bg-[var(--bf-neon-primary)]/20 border border-[var(--bf-neon-primary)]/30 rounded-lg transition-colors neon-text font-medium">
            Retry
          </button>
        </NeonCard>
      ) : null}
    </section>
  );
}
