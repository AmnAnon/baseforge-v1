// src/components/sections/PortfolioSection.tsx
// Portfolio tracker — connect wallet, see aggregated Base positions
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, timeAgo, freshnessColor } from "@/lib/utils";
import {
  Wallet,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  Shield,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";

interface Position {
  protocol: string;
  tvl: number;
  borrowed: number;
  netValue: number;
  category: string;
  healthEstimate: number;
  apy: number;
}

interface PortfolioResponse {
  summary: {
    totalDeposited: number;
    totalBorrowed: number;
    netWorth: number;
    positionCount: number;
    highestRisk: string | null;
    avgHealth: number;
  };
  positions: Position[];
  timestamp: number;
}

export default function PortfolioSection() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?address=${address}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to fetch portfolio");
      }
      const json = await res.json();
      setData(json);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchPortfolio();
  };

  return (
    <section className="space-y-6" aria-labelledby="portfolio-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="portfolio-heading" className="text-2xl font-bold text-white">
            Portfolio Tracker
          </h2>
          <p className="text-sm text-gray-400">
            Track your Base ecosystem positions
          </p>
        </div>
      </div>

      {/* Wallet Input */}
      <Card className="bg-gray-900/60 border-gray-800 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Wallet Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0x... or ENS name"
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchPortfolio}
              disabled={isLoading || !address.trim()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {isLoading ? "Loading..." : "Track"}
            </button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {error && (
        <Card className="p-4 bg-red-900/20 border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {data && !isLoading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Deposited</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(data.summary.totalDeposited)}
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Borrowed</p>
              <p className="text-xl font-bold text-red-400">
                {formatCurrency(data.summary.totalBorrowed)}
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Net Worth</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(data.summary.netWorth)}
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Positions</p>
              <p className="text-xl font-bold text-white">
                {data.summary.positionCount}
              </p>
            </Card>
          </div>

          {/* Positions */}
          {data.positions.length > 0 ? (
            <Card className="bg-gray-900/60 border-gray-800 overflow-hidden">
              <div className="divide-y divide-gray-800">
                {data.positions.map((pos, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          pos.healthEstimate >= 60
                            ? "bg-emerald-900/50 text-emerald-400"
                            : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-white">{pos.protocol}</h3>
                        <p className="text-xs text-gray-500">{pos.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{formatCurrency(pos.netValue)}</p>
                      <p className="text-xs text-gray-400">
                        Dep: {formatCurrency(pos.tvl)} · Borrow: {formatCurrency(pos.borrowed)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-8 bg-gray-900/60 border-gray-800 text-center">
              <p className="text-gray-400">No positions detected for this wallet on Base</p>
              <p className="text-xs text-gray-600 mt-2">Positions are estimated from onchain protocol data</p>
            </Card>
          )}

          {[data.timestamp]}
        </div>
      )}

      {/* Quick Access Addresses */}
      <Card className="bg-gray-900/60 border-gray-800 p-4">
        <p className="text-xs text-gray-500 mb-3">Quick Access</p>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Coinbase 2", addr: "0x41f38175532598F6fDd4407a9E6c6e43D850098E" },
          ].map((wallet) => (
            <button
              key={wallet.name}
              onClick={() => {
                setAddress(wallet.addr);
              }}
              className="px-3 py-1.5 bg-black/40 border border-gray-700 hover:border-emerald-500/30 rounded-lg text-xs text-gray-400 hover:text-emerald-400 transition-colors font-mono"
            >
              {wallet.name}: {wallet.addr.slice(0, 6)}...{wallet.addr.slice(-4)}
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}
