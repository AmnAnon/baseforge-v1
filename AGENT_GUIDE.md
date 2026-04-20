# BaseForge Analytics — Agent Guide

> Last updated: 2025-01 | Data accuracy pass (P0 + P1)

## Overview

BaseForge provides real-time DeFi analytics for the Base blockchain.
All data flows through a multi-source validation pipeline with explicit
confidence scoring and staleness tracking.

---

## Data Fields & Confidence Scores

### Base Metrics (`/api/analytics` → `baseMetrics`)

| Field | Source | Confidence | Notes |
|---|---|---|---|
| `totalTvl` | DefiLlama `/protocols` | High | Sum of `chainTvls.Base` for top 20 non-CEX protocols |
| `change24h` | DefiLlama `/v2/historicalChainTvl/Base` | High | Calculated via `calculate24hChange()` using actual Unix timestamps — NOT adjacent array entries |
| `totalProtocols` | DefiLlama `/protocols` | High | Filtered: TVL > $100K, excludes CEX/Chain/Bridge/RWA |
| `avgApy` | DeFiLlama Yields `/pools?chain=Base` | Medium | Average APY across all Base yield pools; 0 if no pool data |
| `_source` | Set by analytics route | — | Always `"defillama"` for base metrics |
| `_updatedAt` | Server timestamp | — | Unix ms when data was assembled |
| `_confidence` | Derived | — | `"high"` \| `"medium"` \| `"low"` |

### TVL Methodology Note

BaseForge TVL follows **DefiLlama methodology**:
- Uses `chainTvls.Base` (case-insensitive lookup)
- Excludes: CEX, Chain, Bridge, Liquidity Manager, RWA
- Minimum threshold: $100,000 TVL
- Top 20 protocols by Base TVL

This may differ from on-chain TVL calculations by ±2-5% due to:
- Price oracle differences
- LP token valuation methods
- Bridge-locked asset treatment

### 24h Change Calculation

All 24h changes use `calculate24hChange()` from `src/lib/utils.ts`:

```ts
// Takes a time-series sorted by Unix timestamp (seconds)
// Finds the entry closest to 24h ago and computes % change vs latest
calculate24hChange(series: Array<{ value: number; ts: number }>): number | null
```

**Previous bug**: Used adjacent array entries (`tvlHistory[-1]` vs `tvlHistory[-2]`) which could be minutes apart, not 24h apart. Fixed to use actual timestamp windowing.

### Protocol Data (`/api/analytics` → `protocolData[id]`)

| Field | Source | Confidence | Notes |
|---|---|---|---|
| `tvl` | DefiLlama | High | Protocol-specific Base TVL |
| `tvlChange` | DefiLlama `change_1d` | Medium | DefiLlama's own 24h delta (percentage) |
| `totalBorrow` | Estimated | Low | 35% of TVL — replace with Moonwell Ponder or protocol subgraph |
| `utilization` | Estimated | Low | Derived from totalBorrow/tvl |
| `feesAnnualized` | Estimated | Low | TVL × (apy/100 + 0.01) |
| `revenueAnnualized` | Estimated | Low | TVL × 1.5% flat — rough estimate |
| `tokenPrice` | CoinGecko / Redis `baseforge:prices` | Medium | Cached; null if not in SLUG_TO_CG map |

### Data Confidence Levels

```
high   = Live data, < 3 min old, from primary source
medium = Cached data, 3-10 min old, or from fallback source  
low    = Stale data, > 10 min old, or source unavailable
```

Rendered as badges: 🟢 Live · 🟡 Cached · 🔴 Stale

---

## Multi-Source Pipeline

```
Primary:  DefiLlama (TVL, yields, fees)
          ↓ if fails
Fallback: Stale cache (getWithStaleFallback)
          ↓ if no cache
Response: Empty analytics with isStale: true
```

```
Primary:  Envio HyperSync (swap events, whale flows)
          ↓ circuit breaker opens after 3 failures
Fallback: Etherscan V2 + DefiLlama
```

Circuit breakers: `src/lib/circuit-breaker.ts`
- `defillama` — threshold 3, cooldown 60s
- `coingecko` — threshold 3, cooldown 60s
- `eigenphi` — threshold 3, cooldown 60s
- `envio` — managed in `src/lib/data/indexers/index.ts`

---

## Debug Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/debug/status` | Global pipeline health: source, confidence, age for all feeds |
| `GET /api/debug/whales` | Whale data pipeline diagnostics (requires DEBUG_MODE=true) |
| `GET /api/debug/portfolio` | Portfolio pipeline diagnostics (requires DEBUG_MODE=true) |
| `GET /api/health` | Basic liveness check |

---

## Utilities (`src/lib/utils.ts`)

### `calculate24hChange(series, windowSeconds?)`
Computes % change over a time window from a sorted time-series.
Returns `null` if insufficient data.

### `dataConfidence({ source, ageMs, isStale? })`
Returns `"high" | "medium" | "low"` based on data freshness and source quality.

### `freshnessColor(timestamp)`  
Returns a Tailwind class for green/yellow/red based on data age:
- Green: < 1 min
- Yellow: 1–5 min
- Red: > 5 min

---

## Known Estimations (P2 — to be replaced with real data)

| Metric | Current | Target |
|---|---|---|
| `totalBorrow` | 35% of TVL estimate | Moonwell Ponder GraphQL + Aave subgraph |
| `utilization` | Derived from above | Same as above |
| `feesAnnualized` | TVL × formula | DefiLlama fees endpoint per protocol |
| `revenueAnnualized` | TVL × 1.5% | DefiLlama fees endpoint (revenue field) |
| MEV data | EigenPhi API (real) | Already live, no estimation |
| Whale flows | Envio HyperSync (real) | Already live |

---

## Time-Series Storage

- **`risk_snapshots`** table: health scores per protocol, every 5 min via worker
- **`whale_events`** table: persisted on-chain events, deduped by `tx_hash`
- **Redis `stream:latest`**: current snapshot for SSE fan-out
- **Redis `stream:version`**: monotonic counter; clients poll and only fetch when incremented

---

## Adding a New Data Source

1. Add fetcher function in `src/app/api/<route>/route.ts`
2. Add circuit breaker in `src/lib/circuit-breaker.ts` if external API
3. Tag response with `_source`, `_confidence`, `_updatedAt`
4. Add to `/api/debug/status` pipeline checks
5. Update this guide
