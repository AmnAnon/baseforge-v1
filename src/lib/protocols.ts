// src/lib/protocols.ts

export interface Protocol {
  slug: string; // DefiLlama slug
  displayName: string;
  subgraphId: string;
  protocolType: 'Lending' | 'DEX';
}

export const PROTOCOLS: Protocol[] = [
  {
    slug: 'seamless-protocol',
    displayName: 'Seamless',
    subgraphId: '2u4mWUV4xS19ef1MbnxZHWLLMwdPxtVifH46JbonXwXP',
    protocolType: 'Lending',
  },
  {
    slug: 'aave-v3',
    displayName: 'Aave V3',
    subgraphId: 'GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF',
    protocolType: 'Lending',
  },
  {
    slug: 'aerodrome-finance',
    displayName: 'Aerodrome',
    subgraphId: 'GENunSHWLBXm59mBSgPzQ8metBEp9YDfdqwFr91Av1UM',
    protocolType: 'DEX',
  },
  // You can continue to add more protocols here
];

