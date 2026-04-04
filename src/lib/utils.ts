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
