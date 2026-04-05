# BaseForge

> Real-time DeFi analytics dashboard for the Base blockchain ecosystem.

BaseForge aggregates on-chain data from DefiLlama, Llama APIs, Etherscan, and multiple yield/risk sources into a single comprehensive dashboard covering TVL trends, protocol health scores, whale movements, MEV activity, gas tracking, revenue metrics, and portfolio tracking.

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
- [ ] **Dynamic OG images** — Pull live TVL from DefiLlama instead of static fallback values (currently wired with timeout-based fetch, needs caching)
- [ ] **Per-protocol detail pages** — Route `/protocols/[slug]` with TVL chart, risk score, yields, and whale activity
- [ ] **SSE reconnection resilience** — Add exponential backoff and state recovery in `useRealTimeData`
- [ ] **Data validation layer** — Apply Zod schemas to all API route responses (cache layer returns `unknown`, need validation)

### Phase 2 — Farcaster Frame Enhancements (Medium Priority)
- [ ] **Frame state persistence** — Use `state` param in `post_url` to persist button navigation state across interactions
- [ ] **Protocol-specific frames** — When shared, render frame image with that protocol's TVL, risk score, and 7d trend
- [ ] **Frame analytics** — Track frame views/interactions (store in Postgres or analytics service)
- [ ] **Frame miniapp** — Convert to full Farcaster Mini App (`fc:frame:appId`) for embedded dashboard experience

### Phase 3 — Data Quality & Reliability (High Priority)
- [ ] **Fallback data strategy** — When DefiLlama/CoinGecko APIs fail, serve stale cached data with staleness indicator
- [ ] **Rate limiting** — Add API route rate limiting (basic in-memory or Upstash implementation)
- [ ] **Error boundaries** — Wrap major sections in React error boundaries to prevent full-page crashes
- [ ] **Health check endpoint** — `/api/health` returning cache hit rates, API upstream status, DB connectivity

### Phase 4 — Security & Infrastructure (High Priority)
- [ ] **Environment variable audit** — Remove hardcoded values (e.g., `$1800` ETH in whale tracker, `30s` refresh in miniapp)
- [ ] **Input sanitization** — Validate query params on all API routes (dates, slugs, numeric thresholds)
- [ ] **Sentry integration** — Ensure all exceptions route to Sentry (currently configured, need verification)
- [ ] **CI/CD pipeline** — GitHub Actions workflow: lint + typecheck + test + build on PR
- [ ] **Docker support** — Add Dockerfile for self-hosted deployment option

### Phase 5 — Polish & UX (Medium Priority)
- [ ] **Loading skeletons** — Replace inline loading spinners with skeleton placeholders per section
- [ ] **Mobile responsive audit** — Test all 10 dashboard sections on narrow viewports
- [ ] **Protocol compare** — Wire up the compare section with real multi-protocol TVL comparison
- [ ] **Alert engine** — Connect alert rules to database (currently in-memory, loses on restart)
- [ ] **Portfolio tracking** — Integrate with actual wallet balance via ethers.js or viem (currently placeholder)

### Phase 6 — Testing (Low Priority)
- [ ] **API route tests** — Mock DefiLlama/ETC responses, test cache TTL behavior, error cases
- [ ] **Hook tests** — Test `useRealTimeData` SSE connection state machine and reconnection logic
- [ ] **Component tests** — Snapshot key sections with mocked data
- [ ] **E2E smoke tests** — Basic Next.js route accessibility checks (port from removed playwright config)
