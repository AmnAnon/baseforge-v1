// src/lib/viem/balances.ts
// On-chain ERC20 + native ETH balance fetching using viem multicall batching.

import { erc20Abi, formatUnits, type Address } from "viem";
import { basePublicClient } from "./client";

// Base ecosystem tokens we track. Add entries to expand coverage.
const TRACKED_TOKENS = [
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" as const, decimals: 18, coingeckoId: "weth" },
  { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const, decimals: 6, coingeckoId: "usd-coin" },
  { symbol: "USDbC", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" as const, decimals: 6, coingeckoId: "bridged-usd-coin-base" },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as const, decimals: 18, coingeckoId: "coinbase-wrapped-staked-eth" },
  { symbol: "AERO", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as const, decimals: 18, coingeckoId: "aerodrome-finance" },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as const, decimals: 18, coingeckoId: "dai" },
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
    },
    tokens: activeBalances,
  };
}
