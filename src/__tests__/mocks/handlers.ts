// src/__tests__/mocks/handlers.ts
// MSW handlers for all external APIs used by BaseForge.
// Covers: DefiLlama, CoinGecko, Etherscan V2, Envio HyperSync.

import { http, HttpResponse } from "msw";

// ─── DefiLlama ─────────────────────────────────────────────────

const MOCK_PROTOCOL = {
  id: "aerodrome",
  name: "Aerodrome",
  slug: "aerodrome",
  symbol: "AERO",
  logo: "https://icons.llama.fi/aerodrome.png",
  url: "https://aerodrome.finance",
  category: "Dexes",
  chainTvls: { Base: 2_100_000_000 },
  tvl: 2_100_000_000,
  change_1d: 1.2,
  change_7d: 5.4,
  tvlPrevDay: 2_075_000_000,
  tvlPrevWeek: 1_990_000_000,
  audits: 2,
  forks: [],
  oracles: ["Chainlink"],
  chains: ["Base"],
};

const MOCK_PROTOCOL_UNISWAP = {
  id: "uniswap-v3",
  name: "Uniswap V3",
  slug: "uniswap-v3",
  symbol: "UNI",
  logo: "https://icons.llama.fi/uniswap-v3.png",
  url: "https://uniswap.org",
  category: "Dexes",
  chainTvls: { Base: 950_000_000 },
  tvl: 950_000_000,
  change_1d: 0.5,
  change_7d: 2.1,
  tvlPrevDay: 945_000_000,
  tvlPrevWeek: 930_000_000,
  audits: 3,
  forks: [],
  oracles: ["Uniswap TWAP"],
  chains: ["Base", "Ethereum", "Arbitrum"],
};

const MOCK_PROTOCOL_SEAMLESS = {
  id: "seamless-protocol",
  name: "Seamless Protocol",
  slug: "seamless-protocol",
  symbol: "",
  logo: "",
  url: "https://seamlessprotocol.com",
  category: "Lending",
  chainTvls: { Base: 420_000_000 },
  tvl: 420_000_000,
  change_1d: -0.3,
  change_7d: 1.8,
  tvlPrevDay: 421_260_000,
  tvlPrevWeek: 412_573_000,
  audits: 1,
  forks: ["Aave V3"],
  oracles: ["Chainlink", "Pyth"],
  chains: ["Base"],
};

// Unaudited micro-protocol for risk tests
const MOCK_PROTOCOL_RISKY = {
  id: "risky-dex",
  name: "RiskyDEX",
  slug: "risky-dex",
  symbol: "RISKY",
  logo: "",
  url: "",
  category: "Dexes",
  chainTvls: { Base: 500_000 },
  tvl: 500_000,
  change_1d: -15,
  change_7d: -35,
  tvlPrevDay: 588_235,
  tvlPrevWeek: 769_231,
  audits: 0,
  forks: [],
  oracles: [],
  chains: ["Base"],
};

export const defiLlamaHandlers = [
  // GET /protocols — full protocol list
  http.get("https://api.llama.fi/protocols", () =>
    HttpResponse.json([MOCK_PROTOCOL, MOCK_PROTOCOL_UNISWAP, MOCK_PROTOCOL_SEAMLESS, MOCK_PROTOCOL_RISKY])
  ),

  // GET /v2/historicalChainTvl/Base — chain TVL history
  http.get("https://api.llama.fi/v2/historicalChainTvl/Base", () =>
    HttpResponse.json([
      { date: 1710000000, tvl: 7_800_000_000 },
      { date: 1710086400, tvl: 7_900_000_000 },
      { date: 1710172800, tvl: 8_000_000_000 },
      { date: 1710259200, tvl: 8_100_000_000 },
      { date: 1710345600, tvl: 8_200_000_000 },
    ])
  ),

  // GET /overview/protocols — summary
  http.get("https://api.llama.fi/overview/protocols", () =>
    HttpResponse.json({
      protocols: [
        { name: "Aerodrome", tvl: 2_100_000_000, change_1d: 1.2, category: "Dexes" },
        { name: "Uniswap V3", tvl: 950_000_000, change_1d: 0.5, category: "Dexes" },
      ],
    })
  ),

  // GET /protocol/:slug — single protocol TVL history
  http.get("https://api.llama.fi/protocol/:slug", ({ params }) =>
    HttpResponse.json({
      slug: params.slug,
      tvl: [
        { date: 1710000000, totalTvl: 2_000_000_000 },
        { date: 1710086400, totalTvl: 2_050_000_000 },
        { date: 1710172800, totalTvl: 2_100_000_000 },
      ],
    })
  ),

  // GET /overview/fees/base — protocol fees on Base
  http.get("https://api.llama.fi/overview/fees/base", () =>
    HttpResponse.json({
      protocols: [
        { name: "Aerodrome", dailyFees: "500000", totalFees: "50000000" },
        { name: "Uniswap V3", dailyFees: "300000", totalFees: "30000000" },
      ],
    })
  ),

  // GET /healthy — health check
  http.get("https://api.llama.fi/healthy", () =>
    HttpResponse.text("healthy")
  ),
];

// ─── CoinGecko ─────────────────────────────────────────────────

export const coinGeckoHandlers = [
  // GET /simple/price
  http.get("https://api.coingecko.com/api/v3/simple/price", ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.get("ids") || "";

    const prices: Record<string, { usd: number; usd_24h_change: number }> = {};
    for (const id of ids.split(",")) {
      const map: Record<string, { usd: number; usd_24h_change: number }> = {
        ethereum: { usd: 3200, usd_24h_change: 2.5 },
        "base-org": { usd: 0.15, usd_24h_change: 5.2 },
        "aerodrome-finance": { usd: 1.5, usd_24h_change: -1.3 },
      };
      if (map[id]) prices[id] = map[id];
    }
    return HttpResponse.json(prices);
  }),
];

// ─── Etherscan V2 ─────────────────────────────────────────────

export const etherscanHandlers = [
  // GET /v2/api — gas price (Base chain)
  http.get("https://api.etherscan.io/v2/api", ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "eth_gasPrice") {
      return HttpResponse.json({
        status: "1",
        message: "OK",
        result: "0x5f5e100", // 100000000 wei = 0.1 gwei
      });
    }

    if (action === "txlist") {
      return HttpResponse.json({
        status: "1",
        message: "OK",
        result: [
          {
            blockNumber: "20000000",
            timeStamp: String(Math.floor(Date.now() / 1000) - 300),
            hash: "0xabc123",
            from: "0x1234567890123456789012345678901234567890",
            to: "0x0987654321098765432109876543210987654321",
            value: "1000000000000000000",
            gasPrice: "100000000",
            gasUsed: "21000",
            isError: "0",
          },
        ],
      });
    }

    if (action === "eth_blockNumber") {
      return HttpResponse.json({
        status: "1",
        message: "OK",
        result: "0x1312D00", // ~20M
      });
    }

    return HttpResponse.json({ status: "0", message: "NOTOK", result: "Unknown action" });
  }),
];

// ─── Envio HyperSync ─────────────────────────────────────────

export const envioHandlers = [
  // POST /query — HyperSync event log query
  http.post("https://base.hypersync.xyz/query", () =>
    HttpResponse.json({
      data: {
        logs: [
          {
            address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
            topic0: "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7f44571de818661ed",
            topic1: "0x0000000000000000000000001234567890abcdef1234567890abcdef12345678",
            topic2: "0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12",
            topic3: null,
            data: "0x0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000000",
            block_number: 20000000,
            transaction_hash: "0xdef456",
            log_index: 5,
          },
        ],
        blocks: [
          { number: 20000000, timestamp: Math.floor(Date.now() / 1000) - 60, hash: "0xblock123" },
        ],
      },
      next_block: 20000001,
      total_execution_time: 45,
    })
  ),

  // GET /height — chain height
  http.get("https://base.hypersync.xyz/height", () =>
    HttpResponse.json({ height: 20000100 })
  ),
];

// ─── Error / failure handlers ──────────────────────────────────

export function defiLlamaErrorOnce() {
  let called = false;
  return http.get("https://api.llama.fi/protocols", () => {
    if (!called) {
      called = true;
      return new HttpResponse(null, { status: 500, statusText: "Internal Server Error" });
    }
    return HttpResponse.json([MOCK_PROTOCOL]);
  });
}

export function envioErrorOnce() {
  let called = false;
  return http.post("https://base.hypersync.xyz/query", () => {
    if (!called) {
      called = true;
      return new HttpResponse(null, { status: 503, statusText: "Service Unavailable" });
    }
    return HttpResponse.json({
      data: { logs: [], blocks: [] },
      next_block: 20000001,
      total_execution_time: 0,
    });
  });
}

// ─── All handlers combined ────────────────────────────────────

export const allHandlers = [
  ...defiLlamaHandlers,
  ...coinGeckoHandlers,
  ...etherscanHandlers,
  ...envioHandlers,
];
