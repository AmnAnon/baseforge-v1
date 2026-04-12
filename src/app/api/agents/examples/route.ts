// src/app/api/agents/examples/route.ts
// Example payloads and prompt templates for the agent context endpoint.
// Returns sample data, query patterns, and a copy-paste prompt template.

import { NextResponse } from "next/server";

const EXAMPLES = {
  _description: "BaseForge Agent Context API — examples and prompt templates",
  _docs: "https://github.com/your-org/baseforge#data-architecture",

  // ─── Endpoint Reference ────────────────────────────────────────

  endpoints: {
    context: {
      url: "/api/agents/context",
      method: "GET",
      description: "Compressed, LLM-optimized Base DeFi intelligence",
      rateLimit: "20 req/min",
      cacheTTL: "120s",
      params: {
        include: {
          type: "string",
          default: "protocols,risk,market",
          options: "protocols,risk,market,whales,mev,gas,lending,intent — or 'all'",
          example: "?include=protocols,whales,risk,intent",
        },
        protocol: {
          type: "string",
          optional: true,
          description: "Filter to a specific protocol by slug or name substring",
          example: "?protocol=aerodrome",
        },
        timeframe: {
          type: "enum",
          options: ["1h", "6h", "24h"],
          default: "24h",
          example: "?timeframe=6h",
        },
        top: {
          type: "number",
          min: 1,
          max: 50,
          default: 15,
          example: "?top=5",
        },
        compact: {
          type: "boolean",
          default: false,
          description: "Strip verbose fields for ultra-low token usage (~50% smaller)",
          example: "?compact=true",
        },
      },
    },
    swaps: {
      url: "/api/swaps",
      method: "GET",
      description: "Recent DEX swap events (Aerodrome + Uniswap V3)",
      params: "?protocol=aerodrome&min=1000&limit=50",
    },
    whales: {
      url: "/api/whales",
      method: "GET",
      description: "Whale-sized flows across DEXes and lending",
      params: "?min=50000&limit=50",
    },
    lending: {
      url: "/api/lending",
      method: "GET",
      description: "Lending protocol events (Seamless/Aave V3)",
      params: "?action=liquidation&min=10000",
    },
    health: {
      url: "/api/health",
      method: "GET",
      description: "System health including indexer provider status",
    },
  },

  // ─── Common Query Patterns ─────────────────────────────────────

  queryPatterns: [
    {
      name: "Full ecosystem overview",
      url: "/api/agents/context?include=all&top=20",
      tokens: "~1500",
    },
    {
      name: "Quick risk check",
      url: "/api/agents/context?include=risk,market&compact=true",
      tokens: "~400",
    },
    {
      name: "Aerodrome deep dive",
      url: "/api/agents/context?include=protocols,whales,intent&protocol=aerodrome",
      tokens: "~600",
    },
    {
      name: "Whale activity + intent signals",
      url: "/api/agents/context?include=whales,intent,risk",
      tokens: "~800",
    },
    {
      name: "Lending health check",
      url: "/api/agents/context?include=lending,risk&protocol=seamless",
      tokens: "~500",
    },
    {
      name: "Gas timing for trades",
      url: "/api/agents/context?include=gas,market&compact=true",
      tokens: "~300",
    },
  ],

  // ─── Example Response (abbreviated) ────────────────────────────

  exampleResponse: {
    _v: "2.0",
    _schema: "baseforge.agent.context",
    _ts: 1712890800000,
    _iso: "2026-04-12T06:00:00.000Z",
    _chain: "base",
    _chainId: 8453,
    _source: "envio-hypersync",
    _latencyMs: 230,
    _params: {
      include: ["protocols", "risk", "market", "whales"],
      protocol: null,
      timeframe: "24h",
      top: 5,
    },
    market: {
      totalTvl: 8200000000,
      protocols: 340,
      avgApy: 4.2,
      avgHealth: 68,
      tvlTrend: "up",
      tvlTrendPct: 3.5,
      topCategory: "Dexes",
    },
    protocols: [
      {
        id: "aerodrome",
        name: "Aerodrome",
        cat: "Dexes",
        tvl: 2100000000,
        c1d: 1.2,
        c7d: 3.5,
        apy: 8.5,
        dom: 25.6,
        health: 82,
        risk: 18,
        level: "low",
        audit: "audited",
        factors: [],
      },
      {
        id: "uniswap-v3",
        name: "Uniswap V3",
        cat: "Dexes",
        tvl: 950000000,
        c1d: -0.3,
        c7d: 1.2,
        apy: 5.1,
        dom: 11.6,
        health: 90,
        risk: 10,
        level: "low",
        audit: "audited",
        factors: [],
      },
    ],
    risk: {
      avgHealth: 68,
      highRiskCount: 12,
      highRiskProtocols: ["protocol-x", "protocol-y"],
      unauditedCount: 45,
      concentration: {
        level: "MEDIUM",
        dominant: "Aerodrome",
        dominantPct: 25.6,
        hhi: 980,
      },
      anomalies: [
        { id: "protocol-x", reason: "sharp_tvl_decline", severity: "high" },
      ],
      confidence: 0.75,
    },
    whales: {
      flows: [
        {
          tx: "0xabc12345",
          protocol: "aerodrome",
          type: "swap",
          usd: 250000,
          token: "WETH",
          amount: "100.5000",
          from: "0xwhale123",
          to: "0xpool4567",
          block: 12345678,
        },
      ],
      summary: {
        totalVolumeUSD: 1500000,
        largestFlowUSD: 250000,
        netFlowUSD: 50000,
        byType: { swap: 8, deposit: 3, withdraw: 2 },
      },
      count: 13,
      source: "envio-hypersync",
    },
    _ttl: 120,
    _next: "2026-04-12T06:02:00.000Z",
  },

  // ─── Schema Field Reference ────────────────────────────────────

  schemaReference: {
    "_v": "Schema version (semver-ish)",
    "_schema": "Schema identifier for validation",
    "_ts": "Unix timestamp ms when built",
    "_iso": "ISO 8601 timestamp",
    "_chain": "Chain name (always 'base')",
    "_chainId": "EIP-155 chain ID (8453)",
    "_source": "Data provider that served this response",
    "_latencyMs": "Server-side build time in ms",
    "_ttl": "Cache TTL in seconds",
    "_next": "ISO timestamp when fresh data will be available",
    "market.totalTvl": "Total Value Locked across all Base protocols (USD)",
    "market.avgHealth": "Average health score 0-100 (higher = healthier)",
    "market.tvlTrend": "'up' | 'flat' | 'down' based on 30d TVL direction",
    "protocols[].id": "Protocol slug (use for filtering)",
    "protocols[].tvl": "TVL in USD on Base chain",
    "protocols[].c1d": "TVL % change last 24h",
    "protocols[].c7d": "TVL % change last 7d",
    "protocols[].dom": "% share of total Base TVL",
    "protocols[].health": "Health score 0-100",
    "protocols[].risk": "Risk score 0-100 (100-health)",
    "protocols[].level": "'low' | 'medium' | 'high'",
    "protocols[].audit": "'audited' | 'partial' | 'unaudited'",
    "protocols[].factors": "Array of risk factor strings",
    "risk.concentration.hhi": "Herfindahl-Hirschman Index (0-10000, >2500 = concentrated)",
    "risk.confidence": "0-1 confidence in risk assessment",
    "whales.flows[].tx": "Transaction hash prefix",
    "whales.flows[].type": "'swap' | 'deposit' | 'withdraw' | 'borrow' | 'repay'",
    "intents[].signal": "'accumulation' | 'distribution' | 'yield_rotation' | 'risk_escalation'",
    "intents[].confidence": "0-1 confidence in the intent signal",
  },
};

export async function GET() {
  return NextResponse.json(EXAMPLES, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
