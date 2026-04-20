// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number | undefined | null, options: { precision?: number; unit?: string } = {}) => {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: options.precision ?? 2,
  }).format(value);
  return options.unit ? `${formatted} ${options.unit}` : formatted;
};

export const formatPercentage = (value: number | undefined | null, precision: number = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(precision)}%`;
};

export const formatAnnualized = (dailyValue: number | undefined | null, label: string = "Annualized") => {
  if (dailyValue === undefined || dailyValue === null || isNaN(dailyValue)) return 'N/A';
  const annualized = dailyValue * 365;
  return `${formatCurrency(annualized)} (${label})`;
};

/** Format how long ago a timestamp occurred */
export function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Color the freshness text based on staleness */
export function freshnessColor(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60000) return "text-emerald-400";
  if (diffMs < 300000) return "text-yellow-400";
  return "text-red-400";
}

/**
 * calculate24hChange — global utility for computing percentage change over 24h.
 *
 * Accepts a time-series array sorted chronologically (oldest → newest).
 * Each entry must have a numeric `value` and a Unix timestamp (seconds).
 *
 * Returns the percentage change between the closest entry to 24h ago and
 * the latest entry. Returns null when data is insufficient.
 *
 * @example
 *   const pct = calculate24hChange(tvlHistory.map(d => ({ value: d.tvl, ts: d.date })))
 *   // → 2.34 (meaning +2.34%)
 */
export function calculate24hChange(
  series: Array<{ value: number; ts: number }>,
  windowSeconds = 86_400
): number | null {
  if (!series || series.length < 2) return null;

  const sorted = [...series].sort((a, b) => a.ts - b.ts);
  const latest = sorted[sorted.length - 1];
  const targetTs = latest.ts - windowSeconds;

  // Find the entry closest to (targetTs) without going into the future
  let baseline = sorted[0];
  for (const entry of sorted) {
    if (entry.ts <= targetTs) baseline = entry;
    else break;
  }

  if (baseline.value === 0) return null;
  const pct = ((latest.value - baseline.value) / baseline.value) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Compact USD formatter — avoids raw numbers like "$467260000".
 * Token prices < $1000 use two decimal places; larger values use compact notation.
 */
export function formatUsdCompact(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)         return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1)             return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

/**
 * Data confidence level based on source quality and data freshness.
 * Returns "high" | "medium" | "low".
 */
export function dataConfidence(params: {
  source: string;
  ageMs: number;
  isStale?: boolean;
}): "high" | "medium" | "low" {
  if (params.isStale) return "low";
  if (params.ageMs > 10 * 60 * 1000) return "low";    // > 10 min old
  if (params.ageMs > 3 * 60 * 1000) return "medium";  // > 3 min old
  if (params.source === "fallback" || params.source === "cache") return "medium";
  return "high";
}
