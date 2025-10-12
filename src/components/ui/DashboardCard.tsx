// src/components/ui/DashboardCard.tsx
"use client";

import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  change?: number | null;
  isLoading: boolean;
}

export default function DashboardCard({ title, value, change, isLoading }: DashboardCardProps) {
  const isPositive = change != null && change >= 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 shadow-lg">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      {isLoading ? (
        <div className="h-8 w-3/4 bg-gray-700 rounded-md animate-pulse"></div>
      ) : (
        <p className="text-2xl font-bold text-white">{value}</p>
      )}
      {change != null && !isLoading && (
        <div className={`flex items-center text-xs mt-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
          {isPositive ? <ArrowUpIcon size={12} className="mr-1" /> : <ArrowDownIcon size={12} className="mr-1" />}
          <span>{change.toFixed(2)}% 24h</span>
        </div>
      )}
    </div>
  );
}
