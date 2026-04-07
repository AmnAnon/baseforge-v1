// src/components/sections/PortfolioSection.tsx
// Portfolio tracker — paste a wallet address to see real on-chain Base balances via viem.
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, timeAgo, freshnessColor } from "@/lib/utils";
import {
  Wallet,
  AlertTriangle,
  TrendingDown,
  Loader2,
} from "lucide-react";

interface Position {
  symbol: string;
  priceUsd: number;
  balance: string;
  valueUsd: number;
  category: string;
}

interface PortfolioResponse {
  summary: {
    totalUsdValue: number;
    positionCount: number;
    nativeBalance: string;
    topToken: string | null;
  };
  positions: Position[];
  timestamp: number;
  isStale?: boolean;
}

export default function PortfolioSection() {
  const [address, setAddress] = useState("");
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError("Invalid address format. Must be a 0x-prefixed 40-character hex string.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?address=${trimmed}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchPortfolio();
  };

  const quickWallets = [
    { name: "Coinbase 2", addr: "0x41f38175532598F6fDd4407a9E6c6e43D850098E" },
  ];

  return (
    <section className="space-y-6" aria-labelledby="portfolio-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="portfolio-heading" className="text-2xl font-bold text-white">
            Portfolio Tracker
          </h2>
          <p className="text-sm text-gray-400">
            Real on-chain Base balances via viem multicall
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
              placeholder="0x1234...abcd"
              spellCheck={false}
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors placeholder:text-gray-600"
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

      {/* Error */}
      {error && (
        <Card className="p-4 bg-red-900/20 border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {/* Results */}
      {data && !isLoading && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Value</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(data.summary.totalUsdValue)}
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Positions</p>
              <p className="text-xl font-bold text-white">
                {data.summary.positionCount}
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Native Balance</p>
              <p className="text-xl font-bold text-orange-400">
                {parseFloat(data.summary.nativeBalance).toFixed(4)} ETH
              </p>
            </Card>
            <Card className="bg-gray-900/60 border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">Top Asset</p>
              <p className="text-xl font-bold text-white">
                {data.summary.topToken ?? "—"}
              </p>
            </Card>
          </div>

          {/* Position List */}
          {data.positions.length > 0 ? (
            <Card className="bg-gray-900/60 border-gray-800 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-500 uppercase border-b border-gray-800">
                <div className="col-span-4">Asset</div>
                <div className="col-span-3 text-right">Balance</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-3 text-right">Value</div>
              </div>

              <div className="divide-y divide-gray-800">
                {data.positions
                  .sort((a, b) => b.valueUsd - a.valueUsd)
                  .map((pos, i) => (
                    <div
                      key={`${pos.symbol}-${i}`}
                      className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-gray-800/20 transition-colors"
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-900/50 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold">{pos.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-white">{pos.symbol}</h3>
                          <p className="text-xs text-gray-500">{pos.category}</p>
                        </div>
                      </div>

                      <div className="col-span-3 text-right font-mono text-sm text-gray-300">
                        {pos.balance.startsWith("0.") ? pos.balance.slice(0, 8) : parseFloat(pos.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>

                      <div className="col-span-2 text-right text-sm text-gray-400">
                        {pos.priceUsd > 0 ? formatCurrency(pos.priceUsd) : "—"}
                      </div>

                      <div className="col-span-3 text-right">
                        <p className={`text-sm font-medium ${pos.valueUsd > 0 ? "text-white" : "text-gray-500"}`}>
                          {pos.valueUsd > 0 ? formatCurrency(pos.valueUsd) : "—"}
                        </p>
                        {pos.valueUsd < 0.01 && pos.valueUsd > 0 && (
                          <TrendingDown className="h-3 w-3 text-gray-600 inline ml-1" />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          ) : (
            <Card className="p-8 bg-gray-900/60 border-gray-800 text-center">
              <p className="text-gray-400">No positions detected for this wallet on Base</p>
              <p className="text-xs text-gray-600 mt-2">Real on-chain balances are fetched via viem multicall</p>
            </Card>
          )}

          {data.timestamp && (
            <div className={`text-xs text-right ${freshnessColor(data.timestamp)}`}>
              Last updated {timeAgo(data.timestamp)}
              {data.isStale && " (stale data)"}
            </div>
          )}
        </div>
      )}

      {/* Quick Access Addresses */}
      <Card className="bg-gray-900/60 border-gray-800 p-4">
        <p className="text-xs text-gray-500 mb-3">Quick Access</p>
        <div className="flex flex-wrap gap-2">
          {quickWallets.map((wallet) => (
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
