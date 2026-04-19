// src/app/api/whales/route.ts
// Smart Money Cockpit — whale tracker with intent classification,
// whale scoring, and smart wallet labels.
//
// Query params:
//   min   — minimum USD (default 10000, configurable via WHALE_MIN_USD env)
//   limit — max results (default 50, max 200)

import { NextResponse } from "next/server";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { WhalesResponseSchema } from "@/lib/zod/schemas";
import { getWhaleFlows } from "@/lib/data/indexers";

const DEFAULT_MIN_USD = parseInt(process.env.WHALE_MIN_USD || "10000");
const DEFAULT_LIMIT = parseInt(process.env.WHALE_LIMIT || "50");

const EMPTY_WHALES = () => ({
  whales: [],
  summary: { total: 0, largest: 0, avgSize: 0, types: {} },
  timestamp: Date.now(),
  isStale: true,
});

// ─── Smart Wallet Labels ─────────────────────────────────────

const KNOWN_WALLETS: Record<string, { label: string; type: string }> = {
  // Protocol treasuries
  "0x77777777777112587558404cd7fd36a036b49b23": { label: "Aerodrome: Treasury", type: "protocol" },
  "0x9999999999999999999999999999999999999999": { label: "Uniswap: Treasury", type: "protocol" },
  // Market makers
  "0x0000000000000000000000000000000000000000": { label: "Zero Address", type: "system" },
};

function labelAddress(addr: string): { label: string; type: string } | null {
  const lower = addr.toLowerCase();
  if (KNOWN_WALLETS[lower]) return KNOWN_WALLETS[lower];
  return null;
}

// ─── Whale Score (0-100) ─────────────────────────────────────
// Based on: tx frequency, avg size, protocol diversity, recency

interface WhaleProfile {
  address: string;
  txCount: number;
  totalVolume: number;
  protocols: Set<string>;
  types: Set<string>;
  lastSeen: number;
}

function computeWhaleScore(profile: WhaleProfile): number {
  let score = 0;

  // Volume score (0-40)
  const volScore = Math.min(40, Math.log2(profile.totalVolume / 10000) * 8);
  score += volScore;

  // Activity score (0-25)
  const activityScore = Math.min(25, profile.txCount * 3);
  score += activityScore;

  // Diversity score (0-20)
  const diversityScore = Math.min(20, profile.protocols.size * 5);
  score += diversityScore;

  // Type diversity (0-15)
  const typeScore = Math.min(15, profile.types.size * 4);
  score += typeScore;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ─── Intent Classification ────────────────────────────────────

type Intent = "accumulation" | "distribution" | "lp_entry" | "lp_exit" | "leverage" | "deleverage" | "arbitrage" | "transfer";

function classifyIntent(tx: {
  type: string;
  protocol: string;
  from: string;
  to: string;
  valueUSD: number;
  token: string;
}): { intent: Intent; label: string; color: string; confidence: number } {
  const { type, protocol, from, to, valueUSD, token } = tx;

  // LP operations
  if (type === "liquidity_add") {
    return { intent: "lp_entry", label: "LP Entry", color: "var(--bf-neon-primary)", confidence: 0.9 };
  }
  if (type === "liquidity_remove") {
    return { intent: "lp_exit", label: "LP Exit", color: "var(--bf-neon-magenta)", confidence: 0.9 };
  }

  // Lending operations
  if (type === "deposit") {
    return { intent: "accumulation", label: "Accumulation", color: "var(--bf-neon-secondary)", confidence: 0.85 };
  }
  if (type === "withdraw") {
    return { intent: "distribution", label: "Distribution", color: "var(--bf-neon-magenta)", confidence: 0.85 };
  }
  if (type === "borrow") {
    return { intent: "leverage", label: "Leverage", color: "var(--bf-neon-orange, #ff8c00)", confidence: 0.8 };
  }
  if (type === "repay") {
    return { intent: "deleverage", label: "Deleverage", color: "var(--bf-status-warn)", confidence: 0.8 };
  }

  // Swap — could be arbitrage, accumulation, or simple trade
  if (type === "swap") {
    if (valueUSD > 500000) {
      return { intent: "arbitrage", label: "Possible Arb", color: "var(--bf-neon-accent)", confidence: 0.5 };
    }
    return { intent: "accumulation", label: "Large Swap", color: "var(--bf-neon-primary)", confidence: 0.6 };
  }

  // Transfer
  if (type === "transfer") {
    // Check if to a known protocol
    const label = labelAddress(to);
    if (label?.type === "protocol") {
      return { intent: "accumulation", label: "Protocol Deposit", color: "var(--bf-neon-secondary)", confidence: 0.7 };
    }
    return { intent: "transfer", label: "Transfer", color: "var(--bf-text-secondary)", confidence: 0.5 };
  }

  return { intent: "transfer", label: type, color: "var(--bf-text-muted)", confidence: 0.4 };
}

// ─── Response Shape ──────────────────────────────────────────

interface WhaleFlow {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  protocol: string;
  type: string;
  from: string;
  to: string;
  amountUSD: number;
  token: string;
  tokenAmount: string;
}

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

interface WhaleProfileOutput {
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
  type: "accumulation" | "distribution" | "whale_repeat" | "arb_detected";
  description: string;
  confidence: number;
  transactions: string[];
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const minUSDParam = parseInt(url.searchParams.get("min") || String(DEFAULT_MIN_USD));
    const minUSD = Number.isFinite(minUSDParam) && minUSDParam >= 0 ? minUSDParam : DEFAULT_MIN_USD;
    const limitParam = parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : DEFAULT_LIMIT;

    const result = await getWhaleFlows({ minAmountUSD: minUSD, limit });

    // Build whale profiles for scoring
    const profiles = new Map<string, { address: string; txCount: number; totalVolume: number; protocols: Set<string>; types: Set<string>; lastSeen: number }>();
    for (const f of result.flows) {
      for (const addr of [f.from, f.to]) {
        const a = addr.toLowerCase();
        if (!profiles.has(a)) {
          profiles.set(a, { address: a, txCount: 0, totalVolume: 0, protocols: new Set(), types: new Set(), lastSeen: 0 });
        }
        const p = profiles.get(a)!;
        p.txCount++;
        p.totalVolume += f.amountUSD;
        p.protocols.add(f.protocol);
        p.types.add(f.type);
        p.lastSeen = Math.max(p.lastSeen, f.timestamp);
      }
    }

    // Transform flows with intent + scoring + labels
    const whales: WhaleTransaction[] = result.flows.map((f: WhaleFlow) => {
      const { intent, label, color, confidence } = classifyIntent({
        type: f.type,
        protocol: f.protocol,
        from: f.from,
        to: f.to,
        valueUSD: f.amountUSD,
        token: f.token,
      });

      const fromProfile = profiles.get(f.from.toLowerCase());
      const fromScore = fromProfile ? computeWhaleScore(fromProfile) : undefined;

      const fromLabel = labelAddress(f.from);
      const toLabel = labelAddress(f.to);

      return {
        hash: f.txHash,
        from: f.from,
        to: f.to,
        fromLabel: fromLabel?.label,
        toLabel: toLabel?.label,
        value: `${f.tokenAmount} ${f.token}`,
        valueUSD: f.amountUSD,
        timestamp: new Date(f.timestamp * 1000).toISOString(),
        type: f.type,
        tokenSymbol: f.token,
        protocol: f.protocol,
        blockNumber: f.blockNumber,
        intent,
        intentLabel: label,
        intentColor: color,
        intentConfidence: confidence,
        whaleScore: fromScore,
      };
    });

    // Compute whale profiles for sidebar
    const whaleProfiles: WhaleProfileOutput[] = [];
    for (const [addr, p] of profiles.entries()) {
      if (p.txCount >= 2 || p.totalVolume >= 100000) {
        const label = labelAddress(addr);
        whaleProfiles.push({
          address: addr,
          score: computeWhaleScore({ address: addr, txCount: p.txCount, totalVolume: p.totalVolume, protocols: p.protocols, types: p.types, lastSeen: p.lastSeen }),
          txCount: p.txCount,
          totalVolume: Math.round(p.totalVolume),
          protocols: Array.from(p.protocols),
          lastSeen: new Date(p.lastSeen * 1000).toISOString(),
          label: label?.label,
        });
      }
    }
    whaleProfiles.sort((a, b) => b.score - a.score);

    // Detect hot signals
    const hotSignals: HotSignal[] = [];
    const addrGroups = new Map<string, WhaleTransaction[]>();
    for (const w of whales) {
      const key = w.from.toLowerCase();
      const arr = addrGroups.get(key) || [];
      arr.push(w);
      addrGroups.set(key, arr);
    }
    for (const [addr, txs] of addrGroups.entries()) {
      if (txs.length >= 2) {
        const total = txs.reduce((s, t) => s + t.valueUSD, 0);
        const isAcc = txs.some((t) => t.intent === "accumulation" || t.intent === "lp_entry");
        const isArb = txs.some((t) => t.intent === "arbitrage");
        hotSignals.push({
          id: `sig-${addr.slice(0, 8)}`,
          type: isArb ? "arb_detected" : isAcc ? "accumulation" : "distribution",
          description: `${addr.slice(0, 6)}... made ${txs.length} moves (${formatUSD(total)})`,
          confidence: Math.min(0.95, 0.5 + txs.length * 0.15),
          transactions: txs.map((t) => t.hash),
        });
      }
    }

    const responseData = {
      whales,
      whaleProfiles: whaleProfiles.slice(0, 10),
      hotSignals: hotSignals.slice(0, 5),
      summary: {
        total: whales.length,
        largest: result.summary.largestFlowUSD,
        avgSize: whales.length > 0 ? Math.round(result.summary.totalVolumeUSD / whales.length) : 0,
        types: result.summary.byType,
        activeWhales: whaleProfiles.length,
        totalVolumeUSD: result.summary.totalVolumeUSD,
      },
      source: result.source,
      timestamp: result.timestamp,
      isStale: false,
    };

    const validated = validateOrFallback(WhalesResponseSchema, responseData, EMPTY_WHALES(), "whales");
    return NextResponse.json(validated, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
        "X-Cache-Status": "HIT",
        "X-Data-Source": result.source,
      },
    });
  } catch {
    // Try to serve stale cached data before returning empty
    const stale = await (await import("@/lib/cache")).cache.getStale<ReturnType<typeof EMPTY_WHALES>>("idx:whales:10000");
    if (stale && "whales" in stale) {
      return NextResponse.json(
        { ...stale, isStale: true },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=0, stale-while-revalidate=120",
            "X-Data-Source": "stale-cache",
          },
        }
      );
    }
    return NextResponse.json(
      { ...EMPTY_WHALES(), isStale: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, stale-while-revalidate=120",
          "X-Data-Source": "none",
        },
      }
    );
  }
}

function formatUSD(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export const dynamic = "force-dynamic";
export const revalidate = 30;
