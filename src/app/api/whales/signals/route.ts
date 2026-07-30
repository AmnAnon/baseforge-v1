import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export interface SmartMoneySignal {
  id: string;
  wallet: string;
  walletLabel: string;
  walletTag: "Smart Money" | "MEV Bot" | "Yield Whale" | "Gem Hunter";
  winRate: number; // e.g. 84.5
  totalProfitUsd: number;
  signalType: "ACCUMULATION" | "GEM_SNIPE" | "YIELD_ROTATION" | "DUMPING";
  action: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
  protocol: string;
  tokenSymbol: string;
  tokenAddress: string;
  usdValue: number;
  confidenceScore: number; // 0-100
  timeAgo: string;
  txHash: string;
}

const MOCK_SIGNALS: SmartMoneySignal[] = [
  {
    id: "sig-1",
    wallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    walletLabel: "Base Whale #104",
    walletTag: "Gem Hunter",
    winRate: 88.4,
    totalProfitUsd: 342000,
    signalType: "GEM_SNIPE",
    action: "BUY",
    protocol: "Clanker",
    tokenSymbol: "SENTINEL",
    tokenAddress: "0x1111111111111111111111111111111111111111",
    usdValue: 45200,
    confidenceScore: 94,
    timeAgo: "4m ago",
    txHash: "0x8f1e2d3c4b5a6978876543210fedcba9876543210fedcba9876543210fedcba9",
  },
  {
    id: "sig-2",
    wallet: "0x1234567890abcdef1234567890abcdef12345678",
    walletLabel: "Virtuals Alpha Bot",
    walletTag: "Smart Money",
    winRate: 91.2,
    totalProfitUsd: 580000,
    signalType: "ACCUMULATION",
    action: "BUY",
    protocol: "Virtuals Protocol",
    tokenSymbol: "VIRTUAL",
    tokenAddress: "0x0b3e82b77626d8b96bad3a24683072e2cf5451c3",
    usdValue: 128500,
    confidenceScore: 96,
    timeAgo: "12m ago",
    txHash: "0x7a6b5c4d3e2f1a09988776655443322110ffeeddccbbaa998877665544332211",
  },
  {
    id: "sig-3",
    wallet: "0x9876543210fedcba9876543210fedcba987654321",
    walletLabel: "Aerodrome Yield King",
    walletTag: "Yield Whale",
    winRate: 79.5,
    totalProfitUsd: 195000,
    signalType: "YIELD_ROTATION",
    action: "DEPOSIT",
    protocol: "Aerodrome",
    tokenSymbol: "AERO",
    tokenAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    usdValue: 89000,
    confidenceScore: 85,
    timeAgo: "22m ago",
    txHash: "0x6f5e4d3c2b1a0f988776655443322110ffeeddccbbaa9988776655443322110",
  },
  {
    id: "sig-4",
    wallet: "0xabcdef1234567890abcdef1234567890abcdef12",
    walletLabel: "Degen Sniper #42",
    walletTag: "Gem Hunter",
    winRate: 82.1,
    totalProfitUsd: 210000,
    signalType: "GEM_SNIPE",
    action: "BUY",
    protocol: "Uniswap V3",
    tokenSymbol: "DEGEN",
    tokenAddress: "0x4ed4E862860bed51a9570b96d89af5E1B0Efefed",
    usdValue: 67400,
    confidenceScore: 90,
    timeAgo: "38m ago",
    txHash: "0x4d3c2b1a0f988776655443322110ffeeddccbbaa9988776655443322110f98",
  },
];

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      totalSignals: MOCK_SIGNALS.length,
      signals: MOCK_SIGNALS,
      summary: {
        avgWinRate: 85.3,
        totalAccumulatedUsd: 330100,
        topSignal: "GEM_SNIPE",
      },
    });
  } catch (error) {
    logger.error("Error fetching smart money signals", { error: String(error) });
    return NextResponse.json(
      { success: false, error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
