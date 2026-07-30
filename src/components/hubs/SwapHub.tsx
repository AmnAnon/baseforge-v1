"use client";

// src/components/hubs/SwapHub.tsx
// 1-Click Base DEX Swap Hub — OnchainKit Swap + Wagmi Wallet Integration.

import { useAccount } from "wagmi";
import { Swap } from "@coinbase/onchainkit/swap";
import type { Token } from "@coinbase/onchainkit/token";
import { ArrowRightLeft, ShieldCheck, Zap, Sparkles } from "lucide-react";
import WalletConnectButton from "@/components/ui/WalletConnectButton";
import { BASE_CHAIN_ID, BASE_CONTRACTS } from "@/lib/contracts";

const TOKENS: Token[] = [
  {
    address: "" as const,
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
    image: "https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png",
  },
  {
    address: BASE_CONTRACTS.USDC,
    chainId: BASE_CHAIN_ID,
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    image: "https://wallet-api-production.s3.amazonaws.com/uploads/tokens/usdc_289.png",
  },
  {
    address: BASE_CONTRACTS.AERO,
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    name: "Aerodrome",
    symbol: "AERO",
    image: "https://assets.coingecko.com/coins/images/31745/large/aero.png",
  },
  {
    address: "0x4ed4E862860bed51a9570b96d89af5E1B0Efefed" as const, // DEGEN on Base
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    name: "Degen",
    symbol: "DEGEN",
    image: "https://assets.coingecko.com/coins/images/34100/large/degen.png",
  },
  {
    address: "0x0b3e82b77626d8b96bad3a24683072e2cf5451c3" as const, // VIRTUAL on Base
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    name: "Virtual Protocol",
    symbol: "VIRTUAL",
    image: "https://assets.coingecko.com/coins/images/33890/large/virtual.png",
  },
];

export default function SwapHub() {
  const { isConnected, address } = useAccount();

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header card */}
      <div className="rounded-2xl border border-[#00d4ff]/30 bg-gradient-to-r from-black/80 via-[#0a1128]/60 to-black/80 p-5 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[var(--bf-neon-primary)]">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                1-Click Base DEX Swap
                <Sparkles size={16} className="text-amber-400" />
              </h2>
              <p className="text-xs text-[var(--bf-text-secondary)]">
                Instant DEX swap on Base via OnchainKit & Uniswap V3 / Aerodrome
              </p>
            </div>
          </div>
          <div className="hidden sm:block">
            <WalletConnectButton />
          </div>
        </div>

        {/* Security / Builder attribution badge */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-400/90">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} />
            <span>Optimal DEX Routing & Sub-second Execution</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--bf-neon-accent)] font-mono">
            <Zap size={13} />
            <span>Builder Code Attribution Enabled</span>
          </div>
        </div>
      </div>

      {/* Main Swap Container */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-5 backdrop-blur-xl shadow-2xl space-y-4">
        {!isConnected ? (
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex p-4 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[var(--bf-neon-primary)]">
              <Zap size={32} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Connect Wallet to Swap</h3>
              <p className="text-xs text-[var(--bf-text-secondary)] mt-1">
                Connect your Coinbase Smart Wallet or Web3 wallet to trade Base tokens.
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <WalletConnectButton />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>Connected: <strong className="font-mono text-emerald-400">{address?.slice(0, 6)}…{address?.slice(-4)}</strong></span>
              <span>Network: <strong className="text-[var(--bf-neon-primary)]">Base Mainnet (8453)</strong></span>
            </div>

            <div className="rounded-xl border border-white/10 bg-gray-900/80 p-4 shadow-inner">
              <Swap
                from={TOKENS}
                to={TOKENS}
              />
            </div>
          </div>
        )}
      </div>

      {/* Token quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {TOKENS.slice(0, 4).map((token) => (
          <div key={token.symbol} className="rounded-xl border border-white/5 bg-black/40 p-2.5 flex items-center gap-2">
            {token.image && <img src={token.image} alt={token.symbol} className="w-5 h-5 rounded-full" />}
            <div>
              <div className="font-bold text-white">{token.symbol}</div>
              <div className="text-[10px] text-gray-400">{token.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
