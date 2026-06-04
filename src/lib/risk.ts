// src/lib/risk.ts
// Shared risk / health scoring logic for BaseForge.
// Extracted to avoid duplication between API aggregator and background worker.
//
// The worker copy (worker/index.ts) must be manually kept in sync (pure function, no deps on Next/DB).
// Update both when changing scoring rules. See docs/RISK_METHODOLOGY.md for explanation.

export const CATEGORY_BASELINE: Record<string, number> = {
  "Lending": 15,
  "Dexes": 15,
  "Liquid Staking": 20,
  "CDP": 15,
  "Yield": 5,
  "Bridge": 0,
  "Derivatives": 10,
  "Options": 8,
};

// Risk signal thresholds
export const RISK_THRESHOLDS = {
  MAX_TVL_DROP_7D: 0.25,
  MAX_TVL_DROP_24H: 0.1,
  MIN_AUDITS: 1,
  MIN_ORACLES: 2,
  MAX_SINGLE_PROTOCOL_DOMINANCE: 0.4,
  SUSPICIOUS_APY: 1000,
  // On-chain activity signals
  LOW_VOLUME_RATIO: 0.001,    // Volume < 0.1% of TVL is suspicious for DEXes
  HIGH_OUTFLOW_RATIO: 0.1,    // Net outflow > 10% of TVL
};

export interface HealthScoreInput {
  audits: number;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  category: string;
  oracles: string[];
  forkedFrom?: string[];
  apy?: number;
  // Optional on-chain enrichment (from indexer)
  swapVolume24h?: number;
  netFlow24h?: number;
  uniqueTraders24h?: number;
}

export interface HealthScoreResult {
  score: number;
  riskFactors: string[];
}

/**
 * Calculate health score (0-100, higher=safer) and list of risk factors.
 * Starts at neutral 50, adds/subtracts points. Clamped.
 * Matches the methodology in docs/RISK_METHODOLOGY.md + on-chain signals.
 */
export function calculateHealthScore(proto: HealthScoreInput): HealthScoreResult {
  let score = 50; // Neutral baseline
  const riskFactors: string[] = [];

  // Audit bonus
  score += proto.audits * 5;
  if (proto.audits < RISK_THRESHOLDS.MIN_AUDITS) {
    riskFactors.push("No audits");
    score -= 15;
  }

  // Category trust
  score += CATEGORY_BASELINE[proto.category] || 5;

  // TVL size trust
  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  else {
    riskFactors.push("Low TVL");
    score -= 10;
  }

  // Volatility check
  if (Math.abs(proto.tvlChange7d) > RISK_THRESHOLDS.MAX_TVL_DROP_7D * 100) {
    riskFactors.push("High TVL volatility");
    score -= 15;
  } else if (proto.tvlChange7d < -10) {
    riskFactors.push("TVL declining");
    score -= 8;
  }

  if (Math.abs(proto.tvlChange24h) > RISK_THRESHOLDS.MAX_TVL_DROP_24H * 100) {
    riskFactors.push("Extreme 24h TVL swing");
    score -= 10;
  }

  // Oracle diversity
  if (proto.oracles.length < RISK_THRESHOLDS.MIN_ORACLES) {
    riskFactors.push("Limited oracle diversity");
    score -= 5;
  }

  // Fork safety
  if (proto.forkedFrom?.length) score += 3;

  // APY sanity check
  if ((proto.apy || 0) > RISK_THRESHOLDS.SUSPICIOUS_APY) {
    riskFactors.push("Suspiciously high APY");
    score -= 10;
  }

  // On-chain activity signals (from indexer when available)
  if (proto.swapVolume24h !== undefined && proto.tvl > 0) {
    const volumeRatio = proto.swapVolume24h / proto.tvl;
    if (volumeRatio > 0.01) {
      score += 5; // Active protocol
    } else if (volumeRatio < RISK_THRESHOLDS.LOW_VOLUME_RATIO && proto.category === "Dexes") {
      riskFactors.push("Very low trading volume relative to TVL");
      score -= 5;
    }
  }

  if (proto.netFlow24h !== undefined && proto.tvl > 0) {
    const outflowRatio = -proto.netFlow24h / proto.tvl;
    if (outflowRatio > RISK_THRESHOLDS.HIGH_OUTFLOW_RATIO) {
      riskFactors.push("Significant net outflows (>10% TVL)");
      score -= 10;
    } else if (proto.netFlow24h > 0) {
      score += 3; // Net inflows = positive signal
    }
  }

  if (proto.uniqueTraders24h !== undefined) {
    if (proto.uniqueTraders24h > 100) score += 3;
    else if (proto.uniqueTraders24h > 10) score += 1;
    else if (proto.uniqueTraders24h === 0 && proto.category === "Dexes") {
      riskFactors.push("Zero unique traders in 24h");
      score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, riskFactors };
}
