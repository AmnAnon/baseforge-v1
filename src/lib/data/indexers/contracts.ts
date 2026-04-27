// src/lib/data/indexers/contracts.ts
// Known Base chain contract addresses and event signatures for indexing.
// Sources: official docs, BaseScan verified contracts.

// ─── Event Signatures (topic0 hashes) ────────────────────────────────────

export const EVENT_SIGNATURES = {
  // ERC-20
  TRANSFER: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",

  // Uniswap V3 Pool
  UNISWAP_V3_SWAP: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
  UNISWAP_V3_MINT: "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde",
  UNISWAP_V3_BURN: "0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c",

  // Aerodrome Pool (Solidly-style): Swap(indexed sender, indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)
  AERODROME_SWAP: "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b",
  AERODROME_MINT: "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
  AERODROME_BURN: "0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496",

  // Aave V3 / Seamless (Aave V3 fork) Pool
  AAVE_SUPPLY: "0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61",
  AAVE_WITHDRAW: "0x3115d1449a7b732c986cba18244e897a145df0b3b24f850a60c1ac4d47bf36b0",
  AAVE_BORROW: "0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0",
  AAVE_REPAY: "0xa534c8dbe71f871f9f3f77571f15f067af254c85076e80b7cf546357c015698f",
  AAVE_LIQUIDATION: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",

  // Moonwell Comet (Compound V3-style lending)
  MOONWELL_SUPPLY: "0x437876307b53df77593857e895856f469b299b8c4da875dd2506850c33978e42",  // Supply(address,uint256)
  MOONWELL_WITHDRAW: "0x5c68e4776bdbd5005b20dfc17ac38244d62893c56e83f016f3ffea5d07620856", // Withdraw(address,uint256)
  MOONWELL_BORROW: "0x1e16d183ba79a0b6b1bf50e687875429a3a3b9c4b9a43d8a5b7782106cfd1b5b", // Withdraw(address,uint256) [same sig for Comet]
} as const;

// ─── Contract Addresses (Base Mainnet, chain ID 8453) ────────────────────

export const CONTRACTS = {
  // ── Aerodrome ──────────────────────────────────────────────
  AERODROME_ROUTER: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
  AERODROME_FACTORY: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
  AERODROME_VOTER: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
  AERODROME_GAUGE_FACTORY: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",

  // ── Uniswap V3 ────────────────────────────────────────────
  UNISWAP_V3_FACTORY: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  UNISWAP_V3_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481",
  UNISWAP_V3_QUOTER: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
  UNISWAP_V3_POSITION_MANAGER: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",

  // ── Seamless Protocol (Aave V3 fork) ───────────────────────
  SEAMLESS_POOL: "0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7",
  SEAMLESS_DATA_PROVIDER: "0x2A0979257105834789bC6b9E1B00446DFbA8dFBa",

  // ── Moonwell (Comet lending on Base) ────────────────────────
  MOONWELL_USDC: "0x00D3280d865385e530E5F5E87F8c565481B1559f",
  MOONWELL_WETH: "0x628E42Be5363B7989506C5E4F049e1e62C0F3014",
  MOONWELL_CBETH: "0x6e01C198617CC5c38Cdf583b879457259042B5b1",
  MOONWELL_COMP: "0xD2671165570f41BBB3B0097893300b6e61049d3A",

  // ── Tokens ─────────────────────────────────────────────────
  WETH: "0x4200000000000000000000000000000000000006",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  AERO: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  WELL: "0x511c69db9a61b0cb0d77a048aa395f2c7f6b6a36",
} as const;

// ── Token decimals for USD conversion ────────────────────────
export const TOKEN_DECIMALS: Record<string, number> = {
  [CONTRACTS.WETH]: 18,
  [CONTRACTS.USDC]: 6,
  [CONTRACTS.USDbC]: 6,
  [CONTRACTS.DAI]: 18,
  [CONTRACTS.cbETH]: 18,
  [CONTRACTS.AERO]: 18,
  [CONTRACTS.WELL]: 18,
};

// ── Token symbols ────────────────────────────────────────────
export const TOKEN_SYMBOLS: Record<string, string> = {
  [CONTRACTS.WETH]: "WETH",
  [CONTRACTS.USDC]: "USDC",
  [CONTRACTS.USDbC]: "USDbC",
  [CONTRACTS.DAI]: "DAI",
  [CONTRACTS.cbETH]: "cbETH",
  [CONTRACTS.AERO]: "AERO",
  [CONTRACTS.WELL]: "WELL",
};

// ── Whale address labels ─────────────────────────────────────
export const ADDRESS_LABELS: Record<string, string> = {
  [CONTRACTS.AERODROME_ROUTER.toLowerCase()]: "Aerodrome Router",
  [CONTRACTS.AERODROME_FACTORY.toLowerCase()]: "Aerodrome Factory",
  [CONTRACTS.UNISWAP_V3_ROUTER.toLowerCase()]: "Uniswap V3 Router",
  [CONTRACTS.UNISWAP_V3_FACTORY.toLowerCase()]: "Uniswap V3 Factory",
  [CONTRACTS.SEAMLESS_POOL.toLowerCase()]: "Seamless Pool",
  [CONTRACTS.MOONWELL_USDC.toLowerCase()]: "Moonwell USDC",
  [CONTRACTS.MOONWELL_WETH.toLowerCase()]: "Moonwell WETH",
  [CONTRACTS.WETH.toLowerCase()]: "WETH",
  [CONTRACTS.USDC.toLowerCase()]: "USDC",
};
