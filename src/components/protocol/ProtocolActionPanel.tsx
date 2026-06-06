"use client";

// DeFi CTAs on protocol detail — OnchainKit Swap when API key set, else dapp deep links.

import { useAccount } from "wagmi";
import { Swap } from "@coinbase/onchainkit/swap";
import type { Token } from "@coinbase/onchainkit/token";
import { ArrowRightLeft, Droplets, Landmark, ExternalLink } from "lucide-react";
import WalletConnectButton from "@/components/ui/WalletConnectButton";
import {
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
      className="flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-sm hover:border-emerald-500/40 hover:bg-gray-900 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-white">{action.label}</div>
          <div className="text-xs text-gray-500 truncate">{action.description}</div>
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-gray-500 group-hover:text-emerald-400 shrink-0" />
    </a>
  );
}

function InAppSwap({ surface }: { surface: ProtocolSurface }) {
  const eth: Token = { ...SWAP_TOKENS.eth, image: SWAP_TOKENS.eth.image };
  const usdc: Token = { ...SWAP_TOKENS.usdc, image: SWAP_TOKENS.usdc.image };

  const from = surface.defaultSwap?.from === "AERO"
    ? [{ ...SWAP_TOKENS.aero, image: null } as Token, eth, usdc]
    : [eth, usdc];

  const to = surface.slug === "aerodrome-finance"
    ? [usdc, { ...SWAP_TOKENS.aero, image: null } as Token, eth]
    : [usdc, eth];

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gray-900/60 p-3 overflow-hidden">
      <Swap
        title={`Swap on ${surface.name}`}
        from={from}
        to={to}
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
  const surface = getProtocolSurface(slug, protocolName);
  const hasOnchainKit = Boolean(process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY);
  const showInAppSwap =
    hasOnchainKit &&
    isConnected &&
    surface?.actions.some((a) => a.type === "swap");

  if (!surface) {
    return (
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
        No in-app actions for this protocol yet. Explore other indexed protocols: Aerodrome, Uniswap V3,
        Seamless, Moonwell.
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
            Take Action
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {surface.indexed ? "Indexer-backed" : "External"} · {category ?? surface.category}
            {surface.indexed && (
              <span className="text-emerald-500/80 ml-1">· on-chain flows tracked</span>
            )}
          </p>
        </div>
        <WalletConnectButton />
      </div>

      {showInAppSwap ? (
        <InAppSwap surface={surface} />
      ) : (
        <div className="space-y-2">
          {surface.actions.map((action) => (
            <ActionButton key={`${action.type}-${action.href}`} action={action} />
          ))}
          {!hasOnchainKit && surface.actions.some((a) => a.type === "swap") && (
            <p className="text-[11px] text-gray-600">
              Set <code className="text-gray-500">NEXT_PUBLIC_ONCHAINKIT_API_KEY</code> for in-app swaps
              (CDP API key).
            </p>
          )}
          {!isConnected && (
            <p className="text-[11px] text-gray-600">Connect wallet for in-app swap when OnchainKit is configured.</p>
          )}
        </div>
      )}

      <a
        href={surface.dappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
      >
        Open {surface.name} dapp
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}