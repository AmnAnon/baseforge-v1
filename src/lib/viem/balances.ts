// src/lib/viem/balances.ts
// On-chain ERC20 + native ETH balance fetching using viem multicall batching.
// Expanded to cover major Base tokens — add entries to grow coverage.

import { erc20Abi, formatUnits, type Address } from "viem";
import { basePublicClient } from "./client";

export interface TrackedToken {
  symbol: string;
  address: Address;
  decimals: number;
  coingeckoId: string;
  category: "stablecoin" | "eth-derivative" | "governance" | "lending" | "other";
  logoUrl?: string;
}

// Base ecosystem tokens — expanded to 15 top assets by TVL/volume.
export const TRACKED_TOKENS: TrackedToken[] = [
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18, coingeckoId: "weth", category: "eth-derivative" },
  { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, coingeckoId: "usd-coin", category: "stablecoin" },
  { symbol: "USDbC", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", decimals: 6, coingeckoId: "bridged-usd-coin-base", category: "stablecoin" },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18, coingeckoId: "coinbase-wrapped-staked-eth", category: "eth-derivative" },
  { symbol: "AERO", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", decimals: 18, coingeckoId: "aerodrome-finance", category: "governance" },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18, coingeckoId: "dai", category: "stablecoin" },
  // Additional major Base tokens
  { symbol: "WSTETH", address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", decimals: 18, coingeckoId: "wrapped-steth", category: "eth-derivative" },
  { symbol: "COMP", address: "0x9e1028F5F1D5eDE59748FFceE5532509976840E0", decimals: 18, coingeckoId: "compound-governance-token", category: "governance" },
  { symbol: "WELL", address: "0x511c69db9a61b0cb0d77a048aa395f2c7f6b6a36", decimals: 18, coingeckoId: "moonwell", category: "lending" },
  { symbol: "DEGEN", address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", decimals: 18, coingeckoId: "degen-base", category: "other" },
  { symbol: "BRETT", address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", decimals: 18, coingeckoId: "brett", category: "other" },
  { symbol: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", decimals: 18, coingeckoId: "virtual-protocol", category: "other" },
  { symbol: "TOSHI", address: "0xAC1Bd2486aAf3B5C0fc3aD863896978e05245724", decimals: 18, coingeckoId: "toshi", category: "other" },
  { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6, coingeckoId: "tether", category: "stablecoin" },
  { symbol: "LDO", address: "0x898781BFcb99042A95e69700050Fc76aDD04e3D5", decimals: 18, coingeckoId: "lido-dao", category: "governance" },
];

export async function getWalletBalances(walletAddress: Address) {
  // Single multicall for all ERC20 balances — viem batches into one RPC request
  const calls = TRACKED_TOKENS.map((token) => ({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf" as const,
    args: [walletAddress] as const,
  }));

  const results = await basePublicClient.multicall({
    contracts: calls,
    allowFailure: true,
  });

  // Native ETH balance — separate call since it is not a contract invocation
  const ethBalance = await basePublicClient.getBalance({ address: walletAddress });

  const erc20Balances = results.map((result, i) => {
    const token = TRACKED_TOKENS[i];
    const balance = result.status === "success" ? result.result : BigInt(0);
    return {
      ...token,
      balance,
      formatted: formatUnits(balance, token.decimals),
      balanceRaw: balance.toString(),
    };
  });

  // Only return tokens the wallet actually holds — keeps UI clean
  const activeBalances = erc20Balances.filter((b) => b.balance > BigInt(0));

  return {
    native: {
      symbol: "ETH",
      balance: ethBalance,
      formatted: formatUnits(ethBalance, 18),
      category: "eth-derivative" as const,
      coingeckoId: "ethereum",
    },
    tokens: activeBalances,
  };
}
