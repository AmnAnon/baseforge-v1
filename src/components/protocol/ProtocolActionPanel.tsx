"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { Swap } from "@coinbase/onchainkit/swap";
import type { Token } from "@coinbase/onchainkit/token";
import type { TransactionReceipt } from "viem";
import {
  ArrowRightLeft,
  Droplets,
  Landmark,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import WalletConnectButton from "@/components/ui/WalletConnectButton";
import {
  BASE_CHAIN_ID,
  getProtocolSurface,
  SWAP_TOKENS,
  type ProtocolAction,
  type ProtocolSurface,
} from "@/lib/contracts";

const ACTION_ICONS = {
  swap: ArrowRightLeft,
  deposit: Landmark,
  add_liquidity: Droplets,
  borrow: Landmark,
} as const;

function ActionButton({ action }: { action: ProtocolAction }) {
  const Icon = ACTION_ICONS[action.type];
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-gray-700/80 bg-gray-900/80 px-4 py-3 text-sm hover:border-[var(--bf-neon-primary)]/50 hover:bg-gray-850 transition-all group shadow-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-[#00d4ff]/10 text-[var(--bf-neon-primary)] group-hover:scale-105 transition-transform">
          <Icon className="h-4 w-4 shrink-0" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-white group-hover:text-[var(--bf-neon-primary)] transition-colors">{action.label}</div>
          <div className="text-xs text-gray-400 truncate">{action.description}</div>
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-gray-500 group-hover:text-white shrink-0 transition-colors" />
    </a>
  );
}

function InAppSwap({
  surface,
  onSuccess,
}: {
  surface: ProtocolSurface;
  onSuccess: (receipt: TransactionReceipt) => void;
}) {
  const eth: Token = { ...SWAP_TOKENS.eth, image: SWAP_TOKENS.eth.image };
  const usdc: Token = { ...SWAP_TOKENS.usdc, image: SWAP_TOKENS.usdc.image };

  const from = surface.defaultSwap?.from === "AERO"
    ? [{ ...SWAP_TOKENS.aero, image: null } as Token, eth, usdc]
    : [eth, usdc];

  const to = surface.slug === "aerodrome-finance"
    ? [usdc, { ...SWAP_TOKENS.aero, image: null } as Token, eth]
    : [usdc, eth];

  return (
    <div className="rounded-xl border border-[#00d4ff]/30 bg-gray-900/80 p-3.5 overflow-hidden space-y-2.5">
      <div className="flex items-center justify-between text-xs text-gray-300 px-1">
        <span className="font-medium text-white flex items-center gap-1.5">
          <Zap size={14} className="text-[#00d4ff]" />
          Swap on {surface.name}
        </span>
        <span className="text-[11px] font-mono text-emerald-400">⚡ 0.15% Aggregator Fee</span>
      </div>
      <Swap
        from={from}
        to={to}
        experimental={{ useAggregator: true }}
        config={{ maxSlippage: 1.5 }}
        onSuccess={onSuccess}
      />
    </div>
  );
}

interface ProtocolActionPanelProps {
  slug: string;
  protocolName: string;
  category?: string;
}

export default function ProtocolActionPanel({
  slug,
  protocolName,
  category,
}: ProtocolActionPanelProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [txReceipt, setTxReceipt] = useState<TransactionReceipt | null>(null);

  const surface = getProtocolSurface(slug, protocolName);
  const hasOnchainKit = Boolean(process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY);
  const isWrongNetwork = isConnected && chainId !== BASE_CHAIN_ID;
  const showInAppSwap =
    hasOnchainKit &&
    isConnected &&
    !isWrongNetwork &&
    surface?.actions.some((a) => a.type === "swap");

  if (!surface) {
    return (
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
        No in-app actions for this protocol yet. Explore other indexed protocols: Aerodrome, Uniswap V3,
        Seamless, Moonwell, Aave V3, Morpho Blue, Alien Base.
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[var(--bf-neon-primary)]" />
            Take Action
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {surface.indexed ? "Indexer-backed" : "External"} · {category ?? surface.category}
            {surface.indexed && (
              <span className="text-emerald-400 ml-1">· on-chain flows tracked</span>
            )}
          </p>
        </div>
        <WalletConnectButton />
      </div>

      {/* Network mismatch warning */}
      {isWrongNetwork && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-950/30 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <AlertTriangle size={16} className="shrink-0" />
            <span>Switch to Base Mainnet to interact</span>
          </div>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] transition-colors"
          >
            Switch
          </button>
        </div>
      )}

      {/* Swap Confirmation Receipt */}
      {txReceipt && (
        <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 flex items-center justify-between gap-2 text-xs animate-fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Swap Confirmed (Block #{txReceipt.blockNumber.toString()})</span>
          </div>
          <a
            href={`https://basescan.org/tx/${txReceipt.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:text-white underline flex items-center gap-1 font-mono text-[11px]"
          >
            BaseScan <ExternalLink size={10} />
          </a>
        </div>
      )}

      {showInAppSwap ? (
        <InAppSwap surface={surface} onSuccess={(receipt) => setTxReceipt(receipt)} />
      ) : (
        <div className="space-y-2">
          {surface.actions.map((action) => (
            <ActionButton key={`${action.type}-${action.href}`} action={action} />
          ))}
          {!hasOnchainKit && surface.actions.some((a) => a.type === "swap") && (
            <p className="text-[11px] text-gray-500">
              Direct deep links enabled to official {surface.name} verified contracts.
            </p>
          )}
          {!isConnected && (
            <p className="text-[11px] text-gray-500">Connect wallet to execute 1-click in-app trades.</p>
          )}
        </div>
      )}

      <div className="pt-1 border-t border-white/5 flex items-center justify-between text-xs">
        <a
          href={surface.dappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--bf-neon-primary)] hover:text-white transition-colors"
        >
          Open official {surface.name} dApp
          <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-[10px] text-gray-500 font-mono">Base Chain ID: 8453</span>
      </div>
    </div>
  );
}