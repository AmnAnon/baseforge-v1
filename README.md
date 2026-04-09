# BaseForge

> The AI-Ready Intelligence Layer for the Base Ecosystem.

BaseForge ingests real-time on-chain data — TVL, risk signals, whale flows, MEV activity, gas costs, protocol revenue — and compresses it into structured intelligence feeds designed for human traders **and** AI agents. Instead of raw dashboards, BaseForge delivers actionable signal: compressed market state, risk-weighted protocol health, and machine-readable context payloads that LLMs can consume directly.

## Killer Use Cases

1. **Automated Risk Assessment** — Real-time health scoring across every Base protocol, factoring in audit status, TVL concentration, fork lineage, oracle diversity, and 7d flow volatility. Get a single number that tells you whether a protocol is safe to interact with before you sign.

2. **AI Agent Data Ingestion** — Plug your agent into `/api/agents/context` and get the entire Base ecosystem state as a single, compressed JSON payload — market overview, risk scores, protocol rankings, and anomaly signals — token-efficient and purpose-built for LLM context windows (Claude, Gemini, local models).

3. **Whale Tracking & Intent Detection** — Monitor large transactions across Uniswap V3, Aerodrome, and Seamless on Base. Surface whale movements before they impact your positions, with historical flow patterns that reveal accumulation and distribution signatures.

## Features

| Module | Description |
|---|---|
| **Overview** | Top 20 Base protocols by TVL, aggregate metrics, and time-series charts |
| **Protocol Health** | Risk scoring with audit status, smart-contract maturity, dependency depth, and TVL-weighted health |
| **Market Data** | Live prices, market caps, 24h volume, APY trends across Base protocols |
| **Whale Tracker** | Large transactions across Uniswap V3, Aerodrome, and Seamless on Base |
| **MEV Monitor** | Sandwiches, arbitrage, and liquidations with estimated USD extracted |
| **Gas Tracker** | Real-time Base gas prices with historical trends and L1 vs L2 cost breakdown |
| **Revenue Dashboard** | Protocol-level fees, revenue, and treasury tracking |
| **Alerts** | Threshold-based notifications for TVL drops, risk score changes, and whale activity |
| **Portfolio** | Connect wallet to track positions, PnL, and protocol allocations |
| **Base Network** | L1 vs L2 TVL, chain growth, bridging volume |

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Main dashboard — SSE streaming + poll-fallback
│   ├── api/
│   │   ├── analytics/            # Top protocols, TVL history, aggregate metrics
│   │   ├── risk-history/         # Time-series risk scores
│   │   ├── whales/               # Large-tx detection via Etherscan V2
│   │   ├── mev/                  # MEV event monitoring
│   │   ├── gas/                  # Gas price tracking
│   │   ├── revenue/              # Protocol revenue aggregation
│   │   ├── market/               # Market data (prices, APY, volume)
│   │   ├── alerts/               # Alert evaluation engine
│   │   ├── portfolio/            # Wallet position tracking
│   │   ├── protocol-aggregator/  # Risk-scoring engine
│   │   ├── stream/               # SSE streaming gateway
│   │   └── ...
├── lib/
│   ├── cache.ts                  # Unified cache — in-memory + optional Upstash Redis
│   ├── validation.ts             # Zod-based response validation helpers
│   ├── protocol-aggregator.ts    # Cross-source risk scoring and protocol aggregation
│   ├── logger.ts                 # Structured logging
│   ├── rate-limit.ts             # API rate limiting
│   └── db/                       # Drizzle ORM + Neon Postgres schema + client
├── components/
│   ├── sections/                 # Dashboard sections (Overview, Risk, Whales, MEV, etc.)
│   ├── ui/                       # Reusable UI primitives (cards, switches, tables)
│   └── charts/                   # Tremor-based charts (TVL, risk scores)
└── instrumentation.ts            # Node.js instrumentation for monitoring
```

## Getting Started

```bash
npm install
cp .env.example .env.local    # configure API keys and DB URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required Environment Variables

| Variable | Description |
|---|---|
| `ETHERSCAN_API_KEY` | Etherscan V2 API key for whale tracking |
| `DATABASE_URL` | Neon Postgres connection string for risk history and alerts |
| `UPSTASH_REDIS_URL` | Optional — Upstash Redis endpoint for distributed cache |
| `UPSTASH_REDIS_TOKEN` | Optional — Upstash Redis token |
| `CACHE_BACKEND` | `memory` (default) or `upstash` |

## Scripts

```bash
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm run build:analyze # Build with bundle-size analysis
npm run test         # Run Vitest suite
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to DB
npm run db:studio    # Open Drizzle Studio
```

## Tech Stack

- **Framework:** Next.js 15.5 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS 4, Tremor v4, Framer Motion, Lucide icons
- **Data:** DefiLlama API, Llama API, Etherscan V2, CoinGecko, Llama Yields
- **Cache:** In-memory with Upstash Redis option
- **Database:** Neon Postgres with Drizzle ORM
- **Observability:** Sentry, pino structured logging
- **Testing:** Vitest + happy-dom

## Production Roadmap

Remaining items to get BaseForge to a production-ready v1.0:

### Phase 1 — Real-time Data Pipeline (High Priority)
- [x] **Dynamic OG images** — Pull live TVL from DefiLlama with timeout-based fetch and caching
- [x] **Per-protocol detail pages** — Route `/protocols/[slug]` with TVL chart, risk score, yields, and whale activity
- [x] **SSE reconnection resilience** — Exponential backoff and state recovery via `/api/stream`
- [x] **Data validation layer** — Zod schemas applied to all API route responses

### Phase 2 — Farcaster Frame Enhancements (Medium Priority)
- [x] **Frame V2 metadata** — Dynamic OG images, V2 spec compliance via `/api/frame`
- [x] **Protocol-specific frames** — Dynamic OG images with TVL, Health Score, and APY per protocol
- [x] **Frame miniapp** — Full Farcaster Mini App with `.well-known/farcaster.json` manifest, `fc:frame:app_url`, and `action: "app"` launch
- [x] **Frame analytics** — Interaction logging to Postgres with `Promise.race()` timeout, capturing fid, button clicks, cast source, and wallet
- [x] **Frame analytics queries** — Dashboard endpoint for click-through rates, top protocols by frame traffic, and button popularity

### Phase 3 — Data Quality & Reliability (High Priority)
- [x] **Fallback data strategy** — Stale cached data with staleness indicator on all API routes
- [x] **Rate limiting** — In-memory rate limiting middleware applied to API routes
- [x] **Error boundaries** — React error boundaries wrapped on major sections
- [x] **Health check endpoint** — `/api/health` returning system status

### Phase 4 — Security & Infrastructure (High Priority)
- [x] **Environment variable audit** — Documented in `.env.example`, defaults in code
- [x] **Input sanitization** — Zod validation on API routes, query param guards
- [x] **Sentry integration** — Initialized via `instrumentation.ts`, verified with test hook
- [x] **CI/CD pipeline** — GitHub Actions: lint + typecheck + test + build on PR
- [x] **Docker support** — Dockerfile for self-hosted deployment

### Phase 5 — Polish & UX (Medium Priority)
- [x] **Loading skeletons** — Replace inline loading spinners with skeleton placeholders per section
- [x] **Mobile responsive audit** — Test all 10 dashboard sections on narrow viewports
- [x] **Protocol compare** — Wire up the compare section with real multi-protocol TVL comparison
- [x] **Alert engine** — Connected alert rules to Postgres with cooldown, acknowledge, and CRUD API
- [x] **Portfolio tracking** — Viem-based wallet balance tracking with Ethereum + 6 ERC20 tokens on Base via multicall

### Phase 6 — Testing (Low Priority)
- [x] **API route tests** — Mock DefiLlama/external responses, stale cache fallback, error cases, category filtering
- [x] **Hook tests** — `useRealTimeData` SSE connection lifecycle, reconnection with exponential backoff, disconnect cleanup
- [x] **Component tests** — Snapshot key sections with mocked data
- [x] **E2E smoke tests** — Route accessibility checks for `/`, `/api/frame`, `/api/stream`, `/api/analytics`, `/api/health`

---

## Current Progress — Q2 2026: Intelligence Layer Pivot

### Where we started
After completing all 6 phases of the technical roadmap, BaseForge had a solid foundation but faced three critiques: no clear value proposition beyond "dashboard", no obvious killer use case, and no ecosystem layer for developers or agents.

### What we changed
- **Pivoted positioning** from "DeFi analytics dashboard" → **"The AI-Ready Intelligence Layer for the Base Ecosystem"**
- **Added `/api/agents/context`** — a single compressed, token-efficient JSON endpoint designed for LLM ingestion (Claude, Gemini, local models)
- **Added `/api/protocols`** — bulk protocol listing endpoint (was missing root route)

### What's working now
- Farcaster Frame v3 with miniapp support (8/8 tests passing)
- Risk scoring across 580+ Base protocols with health scores, audit status, and risk factors
- SSE streaming with exponential backoff and stale fallback
- Zod-validated API responses with rate limiting (10 req/min per IP)
- 580 protocols served at 23ms avg latency (when not rate-limited)

### Next: The Agent Vision
- **Agent SDK wrapper** — TypeScript/Python client for `/api/agents/context`
- **Intent detection** — pattern recognition over whale flows (accumulation/distribution signals)
- **Predictive risk model** — time-series-based risk projection, not just point-in-time scoring
- **CLI/Developer platform** — `baseforge init`, templates for agents, bots, nodes

### Known Issues
- **Rate limiter dev-mode bypass** — line 58 of `src/lib/rate-limit.ts` checks `NODE_ENV === "development"`, but the value isn't set in the server process. Fix: change to `NODE_ENV !== "production"`.
- **Farcaster Frame root-level meta tags** still use `vNext` in `layout.tsx`; the `/api/frame` route uses `v3` correctly.

## Open Source

BaseForge is open source. Contributions welcome — see the roadmap above for areas that need work.
