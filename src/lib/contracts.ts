// src/lib/contracts.ts
// Protocol surfaces for DeFi CTAs — centralized addresses + action metadata.
// Indexer event-level contracts live in lib/data/indexers/contracts.ts.

import { CONTRACTS as INDEXER_CONTRACTS } from "@/lib/data/indexers/contracts";

export const BASE_CHAIN_ID = 8453;

/** Re-export Base mainnet addresses used by indexers and CTAs. */
export const BASE_CONTRACTS = INDEXER_CONTRACTS;

export type ProtocolActionType = "swap" | "deposit" | "add_liquidity" | "borrow";

export interface ProtocolAction {
  type: ProtocolActionType;
  label: string;
  description: string;
  /** External dapp deep link when in-app swap is unavailable. */
  href: string;
}

export interface ProtocolSurface {
  slug: string;
  name: string;
  category: string;
  dappUrl: string;
  /** True when Envio/Etherscan indexer covers this protocol. */
  indexed: boolean;
  actions: ProtocolAction[];
  /** Default swap pair for OnchainKit (symbol names). */
  defaultSwap?: { from: string; to: string };
}

const AERODROME: ProtocolSurface = {
  slug: "aerodrome-finance",
  name: "Aerodrome",
  category: "Dexs",
  dappUrl: "https://aerodrome.finance",
  indexed: true,
  defaultSwap: { from: "ETH", to: "USDC" },
  actions: [
    {
      type: "swap",
      label: "Swap",
      description: "Trade tokens on Aerodrome",
      href: "https://aerodrome.finance/swap",
    },
    {
      type: "add_liquidity",
      label: "Add Liquidity",
      description: "Provide liquidity to Aerodrome pools",
      href: "https://aerodrome.finance/deposit",
    },
  ],
};

const UNISWAP: ProtocolSurface = {
  slug: "uniswap-v3",
  name: "Uniswap V3",
  category: "Dexs",
  dappUrl: "https://app.uniswap.org",
  indexed: true,
  defaultSwap: { from: "ETH", to: "USDC" },
  actions: [
    {
      type: "swap",
      label: "Swap",
      description: "Trade on Uniswap (Base)",
      href: "https://app.uniswap.org/swap?chain=base",
    },
    {
      type: "add_liquidity",
      label: "Add Liquidity",
      description: "Create or add to a Uniswap V3 position",
      href: "https://app.uniswap.org/positions/create?chain=base",
    },
  ],
};

const SEAMLESS: ProtocolSurface = {
  slug: "seamless-protocol",
  name: "Seamless Protocol",
  category: "Lending",
  dappUrl: "https://app.seamlessprotocol.com",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Supply",
      description: "Deposit collateral on Seamless",
      href: "https://app.seamlessprotocol.com",
    },
    {
      type: "borrow",
      label: "Borrow",
      description: "Borrow against supplied assets",
      href: "https://app.seamlessprotocol.com",
    },
  ],
};

const MOONWELL: ProtocolSurface = {
  slug: "moonwell",
  name: "Moonwell",
  category: "Lending",
  dappUrl: "https://moonwell.fi",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Supply",
      description: "Supply assets to Moonwell markets",
      href: "https://moonwell.fi/markets",
    },
  ],
};

/** Slug aliases from DefiLlama → canonical surface. */
const SURFACES: ProtocolSurface[] = [AERODROME, UNISWAP, SEAMLESS, MOONWELL];

const SLUG_ALIASES: Record<string, string> = {
  aerodrome: "aerodrome-finance",
  "aerodrome-finance": "aerodrome-finance",
  "uniswap-v3": "uniswap-v3",
  uniswap: "uniswap-v3",
  "seamless-protocol": "seamless-protocol",
  seamless: "seamless-protocol",
  moonwell: "moonwell",
  "moonwell-artemis": "moonwell",
};

export function resolveProtocolSlug(slug: string, name?: string): string | null {
  const normalized = slug.toLowerCase().replace(/ /g, "-");
  if (SLUG_ALIASES[normalized]) return SLUG_ALIASES[normalized];

  const byName = name?.toLowerCase() ?? "";
  for (const surface of SURFACES) {
    if (byName.includes(surface.name.toLowerCase())) return surface.slug;
    if (normalized.includes(surface.slug.split("-")[0])) return surface.slug;
  }
  return null;
}

export function getProtocolSurface(slug: string, name?: string): ProtocolSurface | null {
  const canonical = resolveProtocolSlug(slug, name);
  if (!canonical) return null;
  return SURFACES.find((s) => s.slug === canonical) ?? null;
}

/** Base tokens for OnchainKit Swap on protocol detail pages. */
export const SWAP_TOKENS = {
  eth: {
    address: "" as const,
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
    image: "https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png",
  },
  usdc: {
    address: BASE_CONTRACTS.USDC,
    chainId: BASE_CHAIN_ID,
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    image: "https://wallet-api-production.s3.amazonaws.com/uploads/tokens/usdc_289.png",
  },
  aero: {
    address: BASE_CONTRACTS.AERO,
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    name: "Aerodrome",
    symbol: "AERO",
    image: null,
  },
} as const;