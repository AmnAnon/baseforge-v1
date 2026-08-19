// src/lib/contracts.ts
// Protocol surfaces for DeFi CTAs — centralized addresses + action metadata.
// Indexer event-level contracts live in lib/data/indexers/contracts.ts.

import { CONTRACTS as INDEXER_CONTRACTS } from "@/lib/data/indexers/contracts";

export const BASE_CHAIN_ID = 8453;

/** BaseForge Creator / Fee Treasury Address */
export const CREATOR_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_FEE_RECIPIENT || "0x27e661832ba96a322ab158352fa2e106ee3512e1";

/** Default integrator fee: 15 basis points (0.15%) */
export const INTEGRATOR_FEE_BPS = 15;

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

const AAVE_V3: ProtocolSurface = {
  slug: "aave-v3",
  name: "Aave V3",
  category: "Lending",
  dappUrl: "https://app.aave.com",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Supply",
      description: "Deposit collateral on Aave V3 Base",
      href: "https://app.aave.com/?marketName=proto_base_v3",
    },
    {
      type: "borrow",
      label: "Borrow",
      description: "Borrow assets against collateral on Base",
      href: "https://app.aave.com/?marketName=proto_base_v3",
    },
  ],
};

const MORPHO: ProtocolSurface = {
  slug: "morpho",
  name: "Morpho Blue",
  category: "Lending",
  dappUrl: "https://app.morpho.org",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Supply Vault",
      description: "Earn optimized yield on Morpho Blue Base vaults",
      href: "https://app.morpho.org/base/vaults",
    },
    {
      type: "borrow",
      label: "Borrow",
      description: "Borrow against collateral in isolated markets",
      href: "https://app.morpho.org/base/markets",
    },
  ],
};

const COMPOUND_V3: ProtocolSurface = {
  slug: "compound-v3",
  name: "Compound V3",
  category: "Lending",
  dappUrl: "https://app.compound.finance",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Supply",
      description: "Supply assets to Compound V3 Comet on Base",
      href: "https://app.compound.finance/markets?chain=base",
    },
  ],
};

const ALIEN_BASE: ProtocolSurface = {
  slug: "alien-base",
  name: "Alien Base",
  category: "Dexs",
  dappUrl: "https://alienbase.xyz",
  indexed: true,
  defaultSwap: { from: "ETH", to: "USDC" },
  actions: [
    {
      type: "swap",
      label: "Swap",
      description: "Trade tokens on Alien Base",
      href: "https://app.alienbase.xyz/#/swap",
    },
    {
      type: "add_liquidity",
      label: "Provide LP",
      description: "Provide liquidity to Alien Base pools",
      href: "https://app.alienbase.xyz/#/pool",
    },
  ],
};

const BASESWAP: ProtocolSurface = {
  slug: "baseswap",
  name: "BaseSwap",
  category: "Dexs",
  dappUrl: "https://baseswap.fi",
  indexed: true,
  actions: [
    {
      type: "swap",
      label: "Swap",
      description: "Trade tokens on BaseSwap",
      href: "https://baseswap.fi/swap",
    },
  ],
};

const EXTRA_FINANCE: ProtocolSurface = {
  slug: "extra-finance",
  name: "Extra Finance",
  category: "Yield",
  dappUrl: "https://extrafi.io",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Farm",
      description: "Leveraged yield farming on Base",
      href: "https://app.extrafi.io/farm?chain=base",
    },
  ],
};

const OVERNIGHT_FINANCE: ProtocolSurface = {
  slug: "overnight-finance",
  name: "Overnight Finance",
  category: "Yield",
  dappUrl: "https://overnight.fi",
  indexed: true,
  actions: [
    {
      type: "deposit",
      label: "Mint USD+",
      description: "Mint daily yield-bearing USD+ on Base",
      href: "https://app.overnight.fi",
    },
  ],
};

const AVANTIS: ProtocolSurface = {
  slug: "avantis",
  name: "Avantis",
  category: "Perps",
  dappUrl: "https://avantisfi.com",
  indexed: true,
  actions: [
    {
      type: "swap",
      label: "Trade Perps",
      description: "Trade crypto, forex & commodities perps on Base",
      href: "https://app.avantisfi.com/trade",
    },
  ],
};

/** Slug aliases from DefiLlama → canonical surface. */
const SURFACES: ProtocolSurface[] = [
  AERODROME,
  UNISWAP,
  SEAMLESS,
  MOONWELL,
  AAVE_V3,
  MORPHO,
  COMPOUND_V3,
  ALIEN_BASE,
  BASESWAP,
  EXTRA_FINANCE,
  OVERNIGHT_FINANCE,
  AVANTIS,
];

const SLUG_ALIASES: Record<string, string> = {
  aerodrome: "aerodrome-finance",
  "aerodrome-finance": "aerodrome-finance",
  "uniswap-v3": "uniswap-v3",
  uniswap: "uniswap-v3",
  "seamless-protocol": "seamless-protocol",
  seamless: "seamless-protocol",
  moonwell: "moonwell",
  "moonwell-artemis": "moonwell",
  "aave-v3": "aave-v3",
  aave: "aave-v3",
  morpho: "morpho",
  "morpho-blue": "morpho",
  "compound-v3": "compound-v3",
  compound: "compound-v3",
  "alien-base": "alien-base",
  alienbase: "alien-base",
  baseswap: "baseswap",
  "extra-finance": "extra-finance",
  extrafi: "extra-finance",
  "overnight-finance": "overnight-finance",
  overnight: "overnight-finance",
  avantis: "avantis",
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