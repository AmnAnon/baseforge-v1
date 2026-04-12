# Data Sources

BaseForge aggregates data from multiple providers with automatic failover. This document explains each source, what it provides, and how the fallback strategy works.

## Current Data Sources

### 1. Envio HyperSync (Primary Indexer)

**What:** Rust-based blockchain data engine providing direct access to Base chain event logs.

**Why we chose it:** After evaluating Goldsky, Envio, Subsquid, and The Graph in early 2026:

| Criteria | Envio HyperSync | Goldsky | Subsquid | The Graph |
|---|---|---|---|---|
| Raw speed | 2000x vs RPC | Fast (Turbo) | 100-1000x | Standard |
| Benchmark (May 2025) | 1st place | N/A | 2nd (15x slower) | 142x slower |
| Maintenance | Zero (no subgraph) | Deploy subgraph | Deploy squid | Deploy subgraph |
| TypeScript SDK | First-class | CLI-focused | Available | GraphQL |
| Base support | Native | Native | Yes | Yes |
| Real-time latency | Sub-second | Sub-second | Near real-time | Seconds |

**What it provides:**
- Decoded swap events from Aerodrome and Uniswap V3
- Lending events from Seamless (deposits, borrows, repays, liquidations)
- Block timestamps for accurate event timing
- Chain height for health checks

**How we query it:** HTTP POST to `https://base.hypersync.xyz/query` with structured filter on topic0 (event signatures), address filters, and field selection. No subgraph deployment needed — we query raw event logs and decode them in TypeScript.

**Contract coverage:**

| Protocol | Contract | Events Indexed |
|---|---|---|
| Aerodrome | Router, Factory | Swap, Mint, Burn |
| Uniswap V3 | Factory, Router | Swap, Mint, Burn |
| Seamless | Pool (Aave V3 fork) | Supply, Withdraw, Borrow, Repay, Liquidation |

**Env var:** `ENVIO_API_TOKEN`

### 2. DefiLlama (Protocol Metrics)

**What:** Public API aggregating TVL, yields, and fees across 3000+ protocols.

**What it provides:**
- Protocol TVL on Base (per-chain breakdown)
- TVL change (1d, 7d, 30d)
- Category classification (Dexes, Lending, CDP, etc.)
- Audit count and oracle info
- Fork lineage
- Historical TVL time series
- Yield pool APYs (via `yields.llama.fi`)
- Fee/revenue data (via `api.llama.fi/overview/fees`)

**Endpoints used:**
- `api.llama.fi/protocols` — all protocol metadata
- `api.llama.fi/v2/historicalChainTvl/Base` — Base TVL history
- `yields.llama.fi/pools?chain=Base` — yield data
- `api.llama.fi/overview/dexs/base` — DEX volume
- `api.llama.fi/overview/fees/base` — fee data

**Rate limits:** None (public API), but we cache aggressively (5-10 min TTL).

### 3. CoinGecko (Token Prices)

**What:** Cryptocurrency market data API.

**What it provides:**
- ETH and stablecoin prices in USD
- 24h price changes
- Market caps and volume

**Endpoint:** `api.coingecko.com/api/v3/simple/price`

**Rate limits:** Free tier (30 req/min). We cache for 60 seconds.

### 4. Etherscan V2 (Fallback Indexer)

**What:** Block explorer API for Base chain via Etherscan's multi-chain V2 endpoint.

**What it provides:**
- Transaction lists for monitored addresses
- Gas price data
- Block numbers

**Limitations vs Envio:**
- Only transaction-level data (no decoded events)
- 5-request rate limit per second
- No differentiation between swap types
- Pagination-limited (20 txs per page)

**When used:** Only when Envio HyperSync is unavailable (circuit breaker activated).

**Env var:** `ETHERSCAN_API_KEY`

### 5. Neon Postgres (Persistent Storage)

**What:** Serverless Postgres via Neon for data that must persist between deployments.

**What it stores:**
- Alert rules and triggered events
- Frame interaction analytics
- User preferences
- API response cache (optional)

**Tables:** `protocols`, `historical_tvl`, `markets`, `alert_rules`, `alert_events`, `frame_interactions`, `user_preferences`, `api_cache`

**Env var:** `DATABASE_URL`

### 6. Upstash Redis (Optional Distributed Cache)

**What:** Serverless Redis. Optional replacement for in-memory cache.

**Why optional:** In-memory cache works fine for single-instance deployments (Vercel). Redis is needed for multi-region or high-traffic scenarios where cache should be shared.

**Env vars:** `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, `CACHE_BACKEND=upstash`

---

## Fallback Strategy

```
Request arrives
    │
    ▼
┌─────────┐    HIT    ┌──────────┐
│  Cache   │──────────▶│  Return  │
│ (30s-10m)│           │  cached  │
└────┬─────┘           └──────────┘
     │ MISS
     ▼
┌─────────────┐  healthy  ┌──────────────┐
│ Circuit      │──────────▶│    Envio     │──── Success ──▶ Cache + Return
│ Breaker      │           │  HyperSync   │
│ Check        │           └──────┬───────┘
└──────┬───────┘                  │ Failure
       │ unhealthy                ▼
       ▼                   ┌──────────────┐
┌──────────────┐           │  Etherscan   │──── Success ──▶ Cache + Return
│  Etherscan   │           │  V2 Fallback │
│  V2 Fallback │           └──────┬───────┘
└──────┬───────┘                  │ Failure
       │ Failure                  ▼
       ▼                   ┌──────────────┐
┌──────────────┐           │   Return     │
│  Stale cache │           │   error +    │
│  (if exists) │           │   empty data │
└──────────────┘           └──────────────┘
```

**Key behaviors:**
- Circuit breaker re-checks Envio health every 60 seconds
- Stale cache is preferred over empty responses
- API routes never return non-200 errors for data endpoints (they return `isStale: true` instead)
- `X-Data-Source` header tells the client which provider served the response

---

## Cache TTLs

| Data Type | TTL | Rationale |
|---|---|---|
| Swap events | 30s | High-frequency, users expect near-real-time |
| Whale flows | 60s | Expensive query, slight lag acceptable |
| Lending events | 60s | Same as whales |
| Protocol metrics | 2 min | Aggregated data, less volatile |
| Prices | 1 min | Balance between freshness and rate limits |
| Protocol list | 10 min | Changes infrequently |
| TVL history | 5 min | Historical data, rarely changes mid-day |
| Risk analysis | 10 min | Computationally heavy, stable over minutes |
| Indexer health | 15s | Quick check, needs to detect outages fast |

---

## Planned Data Sources

### EigenPhi (MEV Labeling)
Real MEV event classification — sandwiches, arbitrage, liquidations with labeled bot addresses. Currently using tx-size heuristics as placeholder.

### Neynar (Farcaster Social)
Farcaster cast volume and sentiment per protocol. Social signal for "buzz" detection. Partially implemented — requires `NEYNAR_API_KEY`.

### Base RPC (Direct Chain Access)
Direct JSON-RPC for real-time gas prices and block data when Etherscan V2 is rate-limited. The viem client is already configured for portfolio balance queries.
