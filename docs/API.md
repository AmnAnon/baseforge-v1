# API Reference

BaseForge exposes 30+ REST API routes. All routes are rate-limited (10 req/min per IP unless noted), return JSON, and include cache headers.

**Base URL:** `https://baseforge.vercel.app` (or your deployment)

**Common headers on responses:**
- `X-Cache-Status`: `HIT` | `MISS` | `STALE`
- `X-Data-Source`: Data provider that served the response
- `Cache-Control`: Browser/CDN caching directive

---

## Intelligence & Agent Endpoints

### GET `/api/agents/context`

The primary endpoint for AI agents and LLMs. Returns a compressed, structured, high-signal view of the entire Base DeFi ecosystem.

**Rate limit:** 20 req/min (more generous for bots)

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `include` | string | `protocols,risk,market` | Comma-separated sections. Options: `protocols`, `risk`, `market`, `whales`, `mev`, `gas`, `lending`, `intent`. Use `all` for everything. |
| `protocol` | string | — | Filter to a protocol by slug or name (e.g., `aerodrome`) |
| `timeframe` | enum | `24h` | `1h`, `6h`, or `24h` |
| `top` | number | `15` | Number of protocols (1–50) |
| `compact` | boolean | `false` | Strip verbose fields for ~50% token reduction |

**Example request:**
```bash
curl "https://baseforge.vercel.app/api/agents/context?include=protocols,risk,whales,intent&top=5"
```

**Example response:**
```json
{
  "_v": "2.0",
  "_schema": "baseforge.agent.context",
  "_ts": 1712890800000,
  "_iso": "2026-04-12T06:00:00.000Z",
  "_chain": "base",
  "_chainId": 8453,
  "_source": "envio-hypersync",
  "_latencyMs": 230,
  "_params": {
    "include": ["protocols", "risk", "whales", "intent"],
    "protocol": null,
    "timeframe": "24h",
    "top": 5
  },
  "market": {
    "totalTvl": 8200000000,
    "protocols": 340,
    "avgApy": 4.2,
    "avgHealth": 68,
    "tvlTrend": "up",
    "tvlTrendPct": 3.5,
    "topCategory": "Dexes"
  },
  "protocols": [
    {
      "id": "aerodrome",
      "name": "Aerodrome",
      "cat": "Dexes",
      "tvl": 2100000000,
      "c1d": 1.2,
      "c7d": 3.5,
      "apy": 8.5,
      "dom": 25.6,
      "health": 82,
      "risk": 18,
      "level": "low",
      "audit": "audited",
      "factors": []
    }
  ],
  "risk": {
    "avgHealth": 68,
    "highRiskCount": 12,
    "highRiskProtocols": ["protocol-x"],
    "unauditedCount": 45,
    "concentration": {
      "level": "MEDIUM",
      "dominant": "Aerodrome",
      "dominantPct": 25.6,
      "hhi": 980
    },
    "anomalies": [],
    "confidence": 0.9
  },
  "whales": {
    "flows": [
      {
        "tx": "0xabc12345",
        "protocol": "aerodrome",
        "type": "swap",
        "usd": 250000,
        "token": "WETH",
        "amount": "100.5000",
        "from": "0xwhale123",
        "to": "0xpool4567",
        "block": 12345678
      }
    ],
    "summary": {
      "totalVolumeUSD": 1500000,
      "largestFlowUSD": 250000,
      "netFlowUSD": 50000,
      "byType": { "swap": 8, "deposit": 3, "withdraw": 2 }
    },
    "count": 13,
    "source": "envio-hypersync"
  },
  "intents": [
    {
      "signal": "accumulation",
      "protocol": "aerodrome",
      "confidence": 0.7,
      "evidence": "$500,000 net inflows, TVL +1.2% 24h",
      "actionable": "Whales depositing into Aerodrome. TVL trend confirms."
    }
  ],
  "_ttl": 120,
  "_next": "2026-04-12T06:02:00.000Z"
}
```

**Error response (never non-200):**
```json
{
  "_v": "2.0",
  "_stale": true,
  "_error": "context_build_failed",
  "market": { "totalTvl": 0, "protocols": 0 },
  "protocols": [],
  "risk": { "avgHealth": 0, "anomalies": [] }
}
```

### GET `/api/agents/examples`

Interactive API reference with example payloads, query patterns, token estimates, and schema documentation.

**Cache:** 1 hour

---

## Core Data Endpoints

### GET `/api/analytics`

Dashboard overview — top protocols, TVL history, and aggregate metrics.

**Cache:** 5 min (stale fallback enabled)

**Response:**
```json
{
  "baseMetrics": {
    "totalTvl": 8200000000,
    "totalProtocols": 340,
    "avgApy": 4.2,
    "change24h": 1.5
  },
  "tvlHistory": [
    { "date": "Apr 1", "tvl": 7800000000 },
    { "date": "Apr 12", "tvl": 8200000000 }
  ],
  "protocols": [
    { "id": "aerodrome", "name": "Aerodrome", "tvl": 2100000000, "change24h": 1.2, "category": "Dexes" }
  ],
  "timestamp": 1712890800000,
  "isStale": false
}
```

### GET `/api/protocols`

All Base protocols ranked by TVL with basic metadata.

**Query:** `?category=Dexes` — filter by category

**Response:** Array of `{ id, name, slug, category, tvl, change1d, change7d, audits, health, risk }`

### GET `/api/protocols/[slug]`

Detail page for a single protocol. Includes TVL chart data, yields, risk breakdown.

**Example:** `/api/protocols/aerodrome`

### GET `/api/prices`

ETH and USDC prices from CoinGecko.

**Cache:** 1 min

**Response:**
```json
{
  "ethereum": { "usd": 2500, "usd_24h_change": 1.5 },
  "usd-coin": { "usd": 1.0, "usd_24h_change": 0.01 }
}
```

---

## On-Chain Intelligence

### GET `/api/swaps`

Recent DEX swap events from Aerodrome and Uniswap V3. Powered by Envio HyperSync.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `protocol` | string | — | `aerodrome` or `uniswap-v3` |
| `min` | number | `1000` | Minimum swap size in USD |
| `limit` | number | `50` | Max results (up to 200) |

**Response:**
```json
{
  "swaps": [
    {
      "txHash": "0xabc...",
      "blockNumber": 12345678,
      "timestamp": 1712890800,
      "protocol": "aerodrome",
      "pool": "0xpool...",
      "sender": "0xsender...",
      "recipient": "0xrecip...",
      "amountUSD": 50000
    }
  ],
  "total": 42,
  "source": "envio-hypersync",
  "timestamp": 1712890800000
}
```

### GET `/api/whales`

Whale-sized flows across DEXes and lending protocols. Uses Envio HyperSync with Etherscan V2 fallback.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `min` | number | `50000` | Minimum flow size in USD |
| `limit` | number | `50` | Max results (up to 200) |

**Response:**
```json
{
  "whales": [
    {
      "hash": "0xabc...",
      "from": "0xwhale...",
      "to": "Aerodrome Router",
      "value": "100.5 WETH",
      "valueUSD": 250000,
      "timestamp": "2026-04-12T06:00:00.000Z",
      "type": "swap",
      "tokenSymbol": "WETH",
      "protocol": "aerodrome",
      "blockNumber": 12345678
    }
  ],
  "summary": {
    "total": 13,
    "largest": 250000,
    "avgSize": 115000,
    "types": { "swap": 8, "deposit": 3, "withdraw": 2 }
  },
  "source": "envio-hypersync",
  "timestamp": 1712890800000
}
```

### GET `/api/lending`

Lending protocol events from Seamless (Aave V3 fork). Tracks deposits, withdrawals, borrows, repays, and liquidations.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `action` | string | — | Filter: `deposit`, `withdraw`, `borrow`, `repay`, `liquidation` |
| `min` | number | `0` | Minimum amount in USD |
| `limit` | number | `50` | Max results (up to 200) |

**Response:**
```json
{
  "events": [
    {
      "txHash": "0x...",
      "action": "deposit",
      "protocol": "seamless",
      "asset": "0x833589fC...",
      "amountUSD": 100000,
      "user": "0xuser..."
    }
  ],
  "summary": {
    "totalDepositsUSD": 500000,
    "totalBorrowsUSD": 200000,
    "totalLiquidationsUSD": 0,
    "netFlowUSD": 300000
  },
  "source": "envio-hypersync",
  "timestamp": 1712890800000
}
```

---

## Risk & Scoring

### GET `/api/risk`

Risk scoring engine for all Base protocols. Health scores factor in audit status, TVL size, volatility, oracle diversity, on-chain activity, and category trust.

**Cache:** 10 min (stale fallback enabled)

**Response:**
```json
{
  "protocols": [
    {
      "id": "aerodrome",
      "name": "Aerodrome",
      "tvl": 2100000000,
      "healthScore": 82,
      "riskScore": 18,
      "auditStatus": "audited",
      "dominanceScore": 25.6,
      "riskFactors": [],
      "category": "Dexes"
    }
  ],
  "summary": {
    "totalAnalyzed": 50,
    "avgHealthScore": 68,
    "highRiskCount": 12,
    "unauditedCount": 45,
    "dominantProtocol": "Aerodrome",
    "totalBaseTVL": 8200000000,
    "concentrationRisk": "MEDIUM"
  },
  "timestamp": 1712890800000
}
```

### GET `/api/risk-history`

Time-series risk scores for a protocol.

**Query:** `?protocol=aerodrome`

### GET `/api/protocol-aggregator`

Unified protocol profiles merging DefiLlama, CoinGecko, and on-chain indexer data. Returns top 10 with detailed scores.

---

## Market Data

### GET `/api/market`

Token-level market data — prices, market caps, 24h volume, gainers/losers.

**Cache:** 1 min (stale fallback enabled)

### GET `/api/charts`

Time-series data for TVL, fees, revenue, and supply/borrow charts.

**Cache:** 5 min (stale fallback enabled)

### GET `/api/gas`

Base L2 gas prices — base fee, priority fee, L1 blob cost, congestion level.

**Cache:** 1 min

**Response:**
```json
{
  "l2BaseFee": 1000000,
  "l2BaseFeeGwei": 0.001,
  "l2PriorityFee": 100000,
  "l1BlobFeeWei": 50000000000000,
  "totalCostTx": "0.0021 Gwei",
  "congestion": "low",
  "timestamp": 1712890800000
}
```

### GET `/api/revenue`

Protocol-level fee generation and revenue attribution with token emission estimates.

**Cache:** 5 min (stale fallback enabled)

### GET `/api/mev`

MEV activity heuristics. Currently uses tx-size-based heuristics. Labeled data (EigenPhi) planned.

**Note:** Returns `"comingSoon": true` until EigenPhi integration.

---

## Social & Network

### GET `/api/base-overview`

Base network aggregate — total TVL, DEX volume, growth metrics from DefiLlama.

### GET `/api/social`

Farcaster social signals per protocol. Requires `NEYNAR_API_KEY`.

### GET `/api/wallet-labels`

Community-sourced wallet labels (protocol wallets, whales, bots, market makers).

---

## Portfolio & Alerts

### GET `/api/portfolio?address=0x...`

On-chain wallet balances via viem multicall. Returns ETH + 6 major ERC-20 tokens on Base with USD values.

**Requires:** Valid Ethereum address as `address` query parameter.

### GET `/api/alerts`

Evaluates alert rules against live protocol data. Returns triggered alerts with severity and cooldown enforcement.

**Requires:** `DATABASE_URL` for Postgres.

### POST `/api/alerts/rules`

Create a new alert rule.

**Body:**
```json
{
  "type": "tvl_drop",
  "protocol": "aerodrome",
  "condition": "less_than",
  "threshold": 1000000000,
  "severity": "warning",
  "cooldownMinutes": 60
}
```

### GET `/api/alerts/rules`

List all alert rules (enabled + disabled).

### PATCH/DELETE `/api/alerts/rules/[id]`

Update or delete a specific alert rule.

### POST `/api/alerts/acknowledge`

Mark a triggered alert as acknowledged.

**Body:** `{ "eventId": "uuid" }`

---

## Farcaster Frame

### GET/POST `/api/frame`

Farcaster Frame v3 handler. GET returns the initial frame HTML. POST decodes button clicks and returns updated frames. Supports miniapp launch via `action: "app"`.

### GET `/.well-known/farcaster.json`

Dynamic Farcaster miniapp manifest. Resolves `NEXT_PUBLIC_BASE_URL` or `VERCEL_URL` at runtime.

---

## OG Images

### GET `/api/og`

Dynamic Open Graph image (1200×630). Pulls live TVL data from DefiLlama. Edge runtime.

### GET `/api/og/agent`

Agent API OG image (1200×630) — purple-themed for sharing the agent endpoint.

### GET `/api/og/miniapp`

Farcaster miniapp embed image (1200×800, 3:2 ratio).

---

## System

### GET `/api/health`

System health check. Returns status of all upstream dependencies including indexer providers.

**Response:**
```json
{
  "status": "ok",
  "checks": {
    "defillama": { "status": "ok", "latency": 120 },
    "coingecko": { "status": "ok", "latency": 95 },
    "cache": { "status": "ok", "detail": "size=42, hitRate=78.5%" },
    "database": { "status": "ok", "latency": 15 },
    "indexer_primary": { "status": "ok", "latency": 45, "detail": "envio-hypersync block=12345678" },
    "indexer_fallback": { "status": "ok", "latency": 200, "detail": "etherscan-fallback block=12345678" },
    "indexer_active": { "status": "ok", "detail": "active_provider=envio-hypersync" }
  },
  "uptimeSeconds": 86400,
  "timestamp": 1712890800000
}
```

### GET `/api/stream`

Server-Sent Events endpoint. Pushes analytics, prices, and whale data every 30 seconds. Auto-closes after 5 minutes (serverless-safe). Clients should reconnect with exponential backoff.

### GET `/api/admin/analytics`

Frame interaction analytics. Protected by `x-admin-key` header matching `ADMIN_KEY` env var.

**Headers required:** `x-admin-key: your-admin-key`
