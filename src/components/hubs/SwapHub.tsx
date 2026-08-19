"use client";

// src/components/hubs/SwapHub.tsx
// 1-Click Base DEX Swap Hub — OnchainKit Swap + Wagmi Wallet Integration.
// Supports 1-Click Copy-Trading from Smart Money and Whale Signals.

import { useState, useMemo } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { Swap } from "@coinbase/onchainkit/swap";
import type { Token } from "@coinbase/onchainkit/token";
import type { TransactionReceipt } from "viem";
import {
  ArrowRightLeft,
  ShieldCheck,
  Zap,
  Sparkles,
  Fish,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sliders,
} from "lucide-react";
import WalletConnectButton from "@/components/ui/WalletConnectButton";
import { BASE_CHAIN_ID, BASE_CONTRACTS } from "@/lib/contracts";

export interface TargetTokenParam {
  address: string;
  symbol: string;
  name?: string;
  decimals?: number;
  image?: string;
}

export interface CopyTradeContext {
  walletLabel?: string;
  walletAddress?: string;
  action?: string;
  amountUSD?: number;
  winRate?: number;
  signalType?: string;
  protocol?: string;
}

interface SwapHubProps {
  targetToken?: TargetTokenParam;
  copyTradeContext?: CopyTradeContext;
}

const DEFAULT_TOKENS: Token[] = [
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

export default function SwapHub({ targetToken, copyTradeContext }: SwapHubProps = {}) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [slippage, setSlippage] = useState<number>(1.5);
  const [txReceipt, setTxReceipt] = useState<TransactionReceipt | null>(null);

  const isWrongNetwork = isConnected && chainId !== BASE_CHAIN_ID;

  // Construct token list prioritizing targetToken if supplied from a whale signal
  const { fromTokens, toTokens } = useMemo(() => {
    if (!targetToken || !targetToken.symbol) {
      return { fromTokens: DEFAULT_TOKENS, toTokens: DEFAULT_TOKENS };
    }

    const exists = DEFAULT_TOKENS.find(
      (t) =>
        t.symbol.toLowerCase() === targetToken.symbol.toLowerCase() ||
        (targetToken.address && t.address.toLowerCase() === targetToken.address.toLowerCase())
    );

    const formattedTarget: Token = exists ?? {
      address: (targetToken.address || "") as `0x${string}`,
      chainId: BASE_CHAIN_ID,
      decimals: targetToken.decimals || 18,
      name: targetToken.name || targetToken.symbol,
      symbol: targetToken.symbol.toUpperCase(),
      image: targetToken.image || "https://assets.coingecko.com/coins/images/31745/large/aero.png",
    };

    // Keep ETH and USDC as default `from` sources
    const fromList = DEFAULT_TOKENS;
    // Prioritize target token at index 0 in `to` list
    const toList = [formattedTarget, ...DEFAULT_TOKENS.filter((t) => t.symbol !== formattedTarget.symbol)];

    return { fromTokens: fromList, toTokens: toList };
  }, [targetToken]);

  const handleSwapSuccess = (receipt: TransactionReceipt) => {
    setTxReceipt(receipt);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Copy-Trade Context Card (Shown when copying a whale signal) */}
      {copyTradeContext && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-black/80 to-purple-950/40 p-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Fish size={18} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    ⚡ Copy-Trade Mode
                  </span>
                  {copyTradeContext.winRate && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                      {copyTradeContext.winRate}% Win-Rate
                    </span>
                  )}
                </div>
                <div className="text-xs text-white font-medium mt-0.5">
                  Following {copyTradeContext.walletLabel || "Whale"} on Base ({copyTradeContext.protocol || "Aerodrome"})
                </div>
              </div>
            </div>
            {copyTradeContext.amountUSD && (
              <div className="text-right">
                <div className="text-[10px] text-gray-400 uppercase font-mono">Whale Inflow</div>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  ${copyTradeContext.amountUSD.toLocaleString()}
                </div>
              </div>
            )}
          </div>
          {targetToken && (
            <div className="mt-3 pt-2.5 border-t border-white/10 text-xs text-gray-300 flex items-center justify-between">
              <span>Target Asset: <strong className="text-white font-mono">${targetToken.symbol}</strong></span>
              <span className="text-[11px] text-[var(--bf-neon-primary)] font-mono">1-Click Auto Routed</span>
            </div>
          )}
        </div>
      )}

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
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-400/90 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} />
            <span>Optimal Multi-DEX Aggregator Routing</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--bf-neon-accent)] font-mono text-[11px]">
            <Zap size={13} />
            <span>0.15% Smart Liquidity Routing</span>
          </div>
        </div>
      </div>

      {/* Wrong Network Warning Banner */}
      {isWrongNetwork && (
        <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-4 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-fade-in flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-red-400">Unsupported Network Detected</div>
              <div className="text-[11px] text-gray-300">
                Please switch your wallet to Base Mainnet (Chain ID 8453) to swap.
              </div>
            </div>
          </div>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors shadow-lg"
          >
            Switch to Base
          </button>
        </div>
      )}

      {/* Transaction Success Alert */}
      {txReceipt && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-fade-in flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <div>
              <div className="text-xs font-bold text-emerald-400">Swap Confirmed on Base!</div>
              <div className="text-[11px] text-gray-300 font-mono">Block #{txReceipt.blockNumber.toString()}</div>
            </div>
          </div>
          <a
            href={`https://basescan.org/tx/${txReceipt.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>View on BaseScan</span>
            <ExternalLink size={12} />
          </a>
        </div>
      )}

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
                Connect your Coinbase Smart Wallet or Web3 wallet to execute trades on Base.
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <WalletConnectButton />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-400 px-1 flex-wrap gap-2">
              <span>
                Connected: <strong className="font-mono text-emerald-400">{address?.slice(0, 6)}…{address?.slice(-4)}</strong>
              </span>

              {/* Slippage Selector Controls */}
              <div className="flex items-center gap-1.5">
                <Sliders size={12} className="text-gray-400" />
                <span className="text-[11px] text-gray-400">Slippage:</span>
                {[0.5, 1.0, 1.5, 3.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSlippage(val)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      slippage === val
                        ? "bg-[#00d4ff] text-black shadow-[0_0_10px_rgba(0,212,255,0.4)]"
                        : "bg-white/5 hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-gray-900/80 p-4 shadow-inner">
              <Swap
                from={fromTokens}
                to={toTokens}
                experimental={{ useAggregator: true }}
                config={{ maxSlippage: slippage }}
                onSuccess={handleSwapSuccess}
              />
            </div>

            {/* Live Base Gas & Security pill */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 pt-1">
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ⛽ Base L2 Gas: &lt; $0.005
              </span>
              <span className="text-[var(--bf-neon-primary)] font-mono">
                ⚡ Aerodrome / Uniswap Aggregated
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Token quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {toTokens.slice(0, 4).map((token) => (
          <div key={token.symbol} className="rounded-xl border border-white/5 bg-black/40 p-2.5 flex items-center gap-2">
            {token.image && <img src={token.image} alt={token.symbol} className="w-5 h-5 rounded-full" />}
            <div className="min-w-0">
              <div className="font-bold text-white truncate">{token.symbol}</div>
              <div className="text-[10px] text-gray-400 truncate">{token.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

