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
