// src/sdk/index.ts
// Official BaseForge SDK for TypeScript / Node.js & AI Agent Frameworks (ElizaOS, LangChain, AutoGPT).

export interface BaseForgeClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface AgentContextOptions {
  include?: string;
  protocol?: string;
  timeframe?: "1h" | "6h" | "24h";
  top?: number;
  compact?: boolean;
}

export interface BuildTxParams {
  action: "swap" | "deposit" | "withdraw" | "rebalance";
  params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    recipient?: string;
    slippagePercent?: number;
    protocol?: string;
  };
}

export interface BuildTxResponse {
  success: boolean;
  timestamp: number;
  action: string;
  protocol: string;
  transaction: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasEstimate: string;
    description: string;
  };
  simulation: {
    status: string;
    expectedOutput: string;
    minimumOutput: string;
    priceImpactPercent: number;
  };
  attribution: {
    builderAppId: string;
    feeBps: number;
  };
}

export interface TokenLaunch {
  id: string;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  dex: string;
  pairAddress: string;
  createdAgo: string;
  ageMinutes: number;
  initialLiquidityUsd: number;
  currentMarketCap: number;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  holdersCount: number;
  rugCheck: {
    safetyScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    lpLocked: boolean;
    lpBurned: boolean;
    ownershipRenounced: boolean;
    top10HoldersPercent: number;
    mintable: boolean;
    verificationStatus: "verified" | "unverified";
    flags: string[];
  };
}

export interface WhaleSignal {
  id: string;
  wallet: string;
  walletLabel: string;
  walletTag: string;
  winRate: number;
  totalProfitUsd: number;
  signalType: "ACCUMULATION" | "GEM_SNIPE" | "YIELD_ROTATION" | "DUMPING";
  action: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
  protocol: string;
  tokenSymbol: string;
  tokenAddress: string;
  usdValue: number;
  confidenceScore: number;
  timeAgo: string;
  txHash: string;
}

export class BaseForgeClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(config: BaseForgeClientConfig = {}) {
    this.baseUrl = (config.baseUrl || "https://baseforge-v1.vercel.app").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 10000;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "@baseforge/sdk/1.0.0",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`BaseForge API Error [${res.status}]: ${res.statusText}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch compressed, LLM-optimized Base ecosystem intelligence context.
   */
  async getContext(opts: AgentContextOptions = {}) {
    const query = new URLSearchParams();
    if (opts.include) query.set("include", opts.include);
    if (opts.protocol) query.set("protocol", opts.protocol);
    if (opts.timeframe) query.set("timeframe", opts.timeframe);
    if (opts.top) query.set("top", opts.top.toString());
    if (opts.compact) query.set("compact", "true");

    const qs = query.toString();
    return this.request<any>(`/api/agents/context${qs ? `?${qs}` : ""}`);
  }

  /**
   * Fetch live Base DeFi protocol rankings and TVL stats.
   */
  async getProtocols() {
    return this.request<any>("/api/protocols");
  }

  /**
   * Fetch protocol risk scores and health ratings.
   */
  async getRiskScores() {
    return this.request<any>("/api/risk");
  }

  /**
   * Fetch real-time token launches on Base with RugCheck safety metrics.
   */
  async getTokenLaunches(opts: { dex?: string; minSafety?: number } = {}) {
    const query = new URLSearchParams();
    if (opts.dex) query.set("dex", opts.dex);
    if (opts.minSafety) query.set("minSafety", opts.minSafety.toString());

    const qs = query.toString();
    return this.request<{ success: boolean; launches: TokenLaunch[] }>(`/api/tokens/launches${qs ? `?${qs}` : ""}`);
  }

  /**
   * Fetch real-time Smart Money signals and whale move alerts.
   */
  async getWhaleSignals() {
    return this.request<{ success: boolean; signals: WhaleSignal[] }>("/api/whales/signals");
  }

  /**
   * Build raw unsigned EVM transaction calldata for AI Agent execution.
   */
  async buildTransaction(payload: BuildTxParams): Promise<BuildTxResponse> {
    return this.request<BuildTxResponse>("/api/agents/actions/build-tx", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export default BaseForgeClient;
