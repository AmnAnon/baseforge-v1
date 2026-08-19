export type ProtocolCategory = 'Lending' | 'DEX' | 'Yield' | 'Perps' | 'CDP';

export interface Protocol {
  slug: string; // DefiLlama slug
  displayName: string;
  subgraphId?: string;
  protocolType: ProtocolCategory;
  dappUrl?: string;
  verified?: boolean;
}

export const PROTOCOLS: Protocol[] = [
  {
    slug: 'aerodrome-finance',
    displayName: 'Aerodrome',
    subgraphId: 'GENunSHWLBXm59mBSgPzQ8metBEp9YDfdqwFr91Av1UM',
    protocolType: 'DEX',
    dappUrl: 'https://aerodrome.finance',
    verified: true,
  },
  {
    slug: 'uniswap-v3',
    displayName: 'Uniswap V3',
    protocolType: 'DEX',
    dappUrl: 'https://app.uniswap.org',
    verified: true,
  },
  {
    slug: 'seamless-protocol',
    displayName: 'Seamless Protocol',
    subgraphId: '2u4mWUV4xS19ef1MbnxZHWLLMwdPxtVifH46JbonXwXP',
    protocolType: 'Lending',
    dappUrl: 'https://app.seamlessprotocol.com',
    verified: true,
  },
  {
    slug: 'aave-v3',
    displayName: 'Aave V3',
    subgraphId: 'GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF',
    protocolType: 'Lending',
    dappUrl: 'https://app.aave.com',
    verified: true,
  },
  {
    slug: 'moonwell',
    displayName: 'Moonwell',
    protocolType: 'Lending',
    dappUrl: 'https://moonwell.fi',
    verified: true,
  },
  {
    slug: 'morpho',
    displayName: 'Morpho Blue',
    protocolType: 'Lending',
    dappUrl: 'https://app.morpho.org',
    verified: true,
  },
  {
    slug: 'compound-v3',
    displayName: 'Compound V3',
    protocolType: 'Lending',
    dappUrl: 'https://app.compound.finance',
    verified: true,
  },
  {
    slug: 'alien-base',
    displayName: 'Alien Base',
    protocolType: 'DEX',
    dappUrl: 'https://alienbase.xyz',
    verified: true,
  },
  {
    slug: 'baseswap',
    displayName: 'BaseSwap',
    protocolType: 'DEX',
    dappUrl: 'https://baseswap.fi',
    verified: true,
  },
  {
    slug: 'extra-finance',
    displayName: 'Extra Finance',
    protocolType: 'Yield',
    dappUrl: 'https://extrafi.io',
    verified: true,
  },
  {
    slug: 'overnight-finance',
    displayName: 'Overnight Finance',
    protocolType: 'Yield',
    dappUrl: 'https://overnight.fi',
    verified: true,
  },
  {
    slug: 'avantis',
    displayName: 'Avantis',
    protocolType: 'Perps',
    dappUrl: 'https://avantisfi.com',
    verified: true,
  },
];

