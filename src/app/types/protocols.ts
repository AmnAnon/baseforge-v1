export interface Protocol {
  id: string;
  name: string;
  symbol: string;
  address: string;
  logoUrl?: string; // Real protocol logo URL
  tvl: number;
  volume24h: number;
  price: number;
  change24h: number;
  marketCap: number;
  category: string;
  // User Activity Metrics
  activeUsers24h: number;
  activeUsers7d: number;
  newUsers24h: number;
  totalTransactions24h: number;
  avgTransactionSize: number;
  userRetention7d: number; // percentage
  // Profitability Metrics
  feesGenerated24h: number;
  revenue24h: number;
  protocolRevenue24h: number;
  apy: number; // percentage
  avgYield7d: number; // percentage
  profitMargin: number; // percentage
  revenuePerUser: number;
  // Protocol-specific APY metrics
  dexApy?: number; // DEX trading APY
  lendingApy?: number; // Lending supply APY
  borrowApy?: number; // Borrow APY
  // Additional Advanced Metrics
  dominanceScore: number; // percentage of total Base TVL
  liquidityDepth: number;
  tradingEfficiency: number; // volume to TVL ratio
  // NEW Advanced Metrics
  transactionVelocity: number; // transactions per minute
  userGrowthRate: number; // percentage change in users
  liquidityUtilization: number; // percentage of liquidity being actively used
  capitalEfficiencyScore: number; // composite efficiency metric (0-100)
  volatilityIndex: number; // price volatility measure
  networkEffectScore: number; // user engagement and network effects (0-100)
  feeToTvlRatio: number; // fees generated relative to TVL
  riskScore: number; // risk assessment (0-100, lower is better)
  healthScore: number; // overall protocol health (0-100)
}

export interface ProtocolMetrics {
  timestamp: number;
  tvl: number;
  volume: number;
  price: number;
}

export interface UserActivityMetrics {
  activeUsers: number;
  newUsers: number;
  transactions: number;
  retention: number;
}

export interface ProfitabilityMetrics {
  fees: number;
  revenue: number;
  apy: number;
  margin: number;
}
