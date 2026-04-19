// src/lib/intent-engine.ts
// Multi-signal intent engine for Base DeFi protocols.
//
// Each signal is sourced independently and weighted:
//   Signal 1 — TVL momentum  (weight 0.3) — from protocol.c1d / c7d
//   Signal 2 — Net flow      (weight 0.4) — from Redis whale:netflow:{protocol}
//   Signal 3 — Whale ratio   (weight 0.3) — from Redis whale:count:{protocol}:24h
//
// Composite score → signal label + confidence with human-readable evidence.

import { Redis } from "@upstash/redis";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IntentProtocol {
  id: string;
  name: string;
  c1d: number;  // 24h TVL change, percent
  c7d: number;  // 7d  TVL change, percent
  tvl: number;
  level: string;
}

export interface IntentSignal {
  signal: "accumulation" | "distribution" | "neutral" | "mixed";
  protocol: string;
  confidence: number;
  evidence: string[];
  actionable: string;
  _method: "heuristic_v1";
  _signal_count: number;
}

// ─── Redis client (lazy, only when env vars are present) ─────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Redis key helpers ────────────────────────────────────────────────────

interface NetFlowRecord {
  netFlowUsd: number;
}

interface WhaleCountRecord {
  buys: number;
  sells: number;
}

async function readNetFlow(protocol: string): Promise<number | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get<string | NetFlowRecord>(`whale:netflow:${protocol}`);
    if (raw === null || raw === undefined) return null;
    const parsed: NetFlowRecord =
      typeof raw === "string" ? (JSON.parse(raw) as NetFlowRecord) : raw;
    return typeof parsed.netFlowUsd === "number" ? parsed.netFlowUsd : null;
  } catch {
    return null;
  }
}

async function readWhaleCount(
  protocol: string,
): Promise<{ buys: number; sells: number } | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get<string | WhaleCountRecord>(
      `whale:count:${protocol}:24h`,
    );
    if (raw === null || raw === undefined) return null;
    const parsed: WhaleCountRecord =
      typeof raw === "string" ? (JSON.parse(raw) as WhaleCountRecord) : raw;
    if (
      typeof parsed.buys === "number" &&
      typeof parsed.sells === "number"
    ) {
      return { buys: parsed.buys, sells: parsed.sells };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Clamp helper ─────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Single-protocol computation ─────────────────────────────────────────

async function computeForProtocol(
  p: IntentProtocol,
): Promise<IntentSignal | null> {
  // ── Signal 1: TVL momentum (weight 0.3) ──────────────────
  const momentumScore = clamp(
    (p.c7d * 0.6 + p.c1d * 0.4) / 100,
    -1,
    1,
  );
  const sig1Available = true; // always present

  // ── Signal 2: Net flow direction (weight 0.4) ─────────────
  const netFlowUsd = await readNetFlow(p.id);
  const sig2Available = netFlowUsd !== null;
  const flowScore = sig2Available
    ? clamp(netFlowUsd! / 1_000_000, -1, 1)
    : 0;

  // ── Signal 3: Whale activity ratio (weight 0.3) ───────────
  const whaleCounts = await readWhaleCount(p.id);
  const sig3Available = whaleCounts !== null;
  const { buys = 0, sells = 0 } = whaleCounts ?? {};
  const whaleScore = sig3Available
    ? (buys - sells) / (buys + sells + 1)
    : 0;

  // ── Redistribute weights when signals are missing ─────────
  // If sig2 is missing we redistribute its 0.4 equally to the other two.
  const w1 = sig2Available ? 0.3 : 0.3 + 0.2; // 0.3 or 0.5
  const w2 = sig2Available ? 0.4 : 0;
  const w3 = sig2Available ? 0.3 : 0.3 + 0.2; // 0.3 or 0.5

  const raw = momentumScore * w1 + flowScore * w2 + whaleScore * w3;

  const signalCount =
    (sig1Available ? 1 : 0) +
    (sig2Available ? 1 : 0) +
    (sig3Available ? 1 : 0);

  // ── Classify ───────────────────────────────────────────────
  let signal: IntentSignal["signal"];
  if (raw > 0.3) signal = "accumulation";
  else if (raw < -0.3) signal = "distribution";
  else if (Math.abs(raw) < 0.1) signal = "neutral";
  else signal = "mixed";

  // Only surface signals with a meaningful direction
  if (signal === "neutral") return null;

  let confidence = parseFloat(Math.abs(raw).toFixed(2));

  // ── Evidence strings ───────────────────────────────────────
  const evidence: string[] = [];

  const tvlDir = p.c7d >= 0 ? "+" : "";
  evidence.push(`TVL ${tvlDir}${p.c7d.toFixed(1)}% over 7d`);

  if (sig2Available) {
    const abs = Math.abs(netFlowUsd!);
    const dir = netFlowUsd! >= 0 ? "inflows" : "outflows";
    const display =
      abs >= 1_000_000
        ? `$${(abs / 1_000_000).toFixed(1)}M`
        : `$${Math.round(abs).toLocaleString()}`;
    evidence.push(`Net ${dir} ${display} in 24h`);
  }

  if (sig3Available) {
    evidence.push(
      `${buys} whale buy${buys !== 1 ? "s" : ""} vs ${sells} whale sell${sells !== 1 ? "s" : ""} in 24h`,
    );
  }

  evidence.push(`Data signals: ${signalCount}/3`);

  if (signalCount < 2) {
    confidence = parseFloat((confidence * 0.5).toFixed(2));
    evidence.push("Low confidence — insufficient on-chain data");
  }

  // ── Actionable summary ─────────────────────────────────────
  const actionable =
    signal === "accumulation"
      ? `${p.name}: positive momentum with ${signalCount < 2 ? "limited" : "multi-signal"} confirmation. TVL trend and${sig2Available ? " net inflows" : " on-chain data"} align.`
      : signal === "distribution"
        ? `${p.name}: negative momentum with ${signalCount < 2 ? "limited" : "multi-signal"} confirmation. Consider reducing exposure.`
        : `${p.name}: mixed signals — direction unclear. Monitor before acting.`;

  return {
    signal,
    protocol: p.id,
    confidence,
    evidence,
    actionable,
    _method: "heuristic_v1",
    _signal_count: signalCount,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function computeIntentSignals(
  protocols: IntentProtocol[],
): Promise<IntentSignal[]> {
  // Run all protocols in parallel — Redis reads are cheap and independent
  const results = await Promise.allSettled(
    protocols.slice(0, 20).map((p) => computeForProtocol(p)),
  );

  const signals: IntentSignal[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value !== null) {
      signals.push(r.value);
    }
  }

  // Sort by confidence descending, cap at 10
  return signals
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}
