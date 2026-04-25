# CLAUDE.md — BaseForge Analytics: Complete Production Rebuild

> You are a senior full-stack Web3 engineer with deep expertise in DeFi protocol analytics,
> real-time data pipelines, Next.js App Router, and production-grade TypeScript. You write
> code that is correct, fast, and maintainable. You do not write placeholder values. You do
> not leave TODO comments. Every feature you build is wired end-to-end.

---

## PHASE 0 — BOOTSTRAP (Run this first, every fresh session)

```bash
# 1. Clone and enter
git clone https://github.com/AmnAnon/baseforge
cd baseforge

# 2. Install deps (one at a time to avoid OOM on mobile)
npm install next
npm install react react-dom
npm install typescript @types/react @types/node
npm install tailwindcss postcss autoprefixer
npm install @tremor/react
npm install recharts
npm install swr
npm install zod
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install framer-motion
npm install lucide-react
npm install clsx tailwind-merge
npm install viem
npm install @sentry/nextjs
npm install next-themes

# 3. Audit what exists
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next | head -60
cat package.json
ls app/
ls components/ 2>/dev/null || echo "no components dir"
ls lib/ 2>/dev/null || echo "no lib dir"
cat .env.local 2>/dev/null || cat .env.example 2>/dev/null || echo "no env file"
```

After audit, report back:
- Which routes/pages exist and their current state
- Which API routes exist
- What data fetching is currently wired
- What is broken and why

Do NOT start coding until you have done this audit and understood the existing structure.

---

## PROJECT CONTEXT

**What BaseForge is:** A production-grade, multi-protocol DeFi analytics dashboard for the
Base blockchain. Not a DefiLlama wrapper. Not a portfolio tracker. A **layer of intelligence
on top of Base** — protocol-level analytics, real-time whale activity, risk signals, MEV
exposure, and an AI Agent API that external agents can query.

**Target users:**
- DeFi power users managing significant capital on Base
- Quant traders looking for edge signals
- Protocol teams benchmarking themselves
- AI agents that need structured Base DeFi context

**Non-goals:**
- Being a wallet/portfolio tracker (use DeBank for that)
- Supporting multiple chains (Base-only, this is a strength)
- Competing with Dune on SQL queries

---

## DESIGN SYSTEM

Execute this design direction precisely. Do not deviate.

### Visual Identity
- **Theme:** Dark-first. Deep navy-black (`#0A0E1A`) base, not pure black.
- **Accent:** Electric blue (`#3B82F6`) for primary actions and live data indicators.
- **Secondary accent:** Cyan (`#06B6D4`) for positive deltas and yield numbers.
- **Danger:** `#EF4444` for negative deltas, liquidation risk.
- **Warning:** `#F59E0B` for medium risk, stale data.
- **Surface:** `#111827` for cards, `#1F2937` for elevated surfaces.
- **Border:** `#1E293B` — subtle, structural.
- **Text:** `#F9FAFB` primary, `#9CA3AF` secondary, `#6B7280` muted.

### Typography
- **Display:** `Space Grotesk` — for large numbers and hero metrics
- **UI:** `Inter` — for labels, nav, body
- **Mono:** `JetBrains Mono` — for addresses, hashes, raw data values

### Component Rules
- Cards: `rounded-xl border border-[#1E293B] bg-[#111827]`
- Live indicator: Pulsing green dot (`animate-pulse`) next to any real-time value
- Loading state: Shimmer skeleton — NEVER show `$0` or `0` while loading
- Negative space: Generous padding. Data dashboards get cluttered fast.
- Numbers: Always format with `Intl.NumberFormat`. `$5.66B`, not `5660000000`.

### Micro-interactions
- Hover on protocol rows: subtle left border highlight in electric blue
- Number updates: flash animation on value change (green for up, red for down)
- Tab switches: 150ms fade transition, no layout shift
- Tooltips: Always explain what a metric means (DeFi users deserve education)

---

## DATA ARCHITECTURE

### Sources (in priority order)

**1. DefiLlama API (primary — free, no key needed)**
```
Base URL: https://api.llama.fi
Endpoints to use:
  GET /protocols                          → all protocols, filter chain: "Base"
  GET /protocol/{slug}                    → single protocol full data
  GET /v2/historicalChainTvl/Base         → Base TVL history (charts)
  GET /yields/pools                       → APY data, filter chain: "Base"
  GET /fees                               → protocol fees, filter chain: "Base"
  GET /overview/fees/Base                 → fee summary
  GET /overview/dexs/Base                 → DEX volume
  GET /bridges                            → bridge data
```

**2. Base RPC (for gas, blocks, transactions)**
```
Primary:  https://mainnet.base.org (free, public)
Fallback: https://base.llamarpc.com

Key calls (use viem's publicClient):
  eth_gasPrice                    → current gas
  eth_blockNumber                 → latest block
  eth_getBlockByNumber            → block data
```

**3. CoinGecko API (prices — free tier)**
```
Base URL: https://api.coingecko.com/api/v3
Endpoints:
  GET /simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true
  GET /coins/{id}/market_chart?vs_currency=usd&days=30
```

**4. Basescan API (whale tracking, large txns)**
```
Base URL: https://api.basescan.org/api
Key: BASESCAN_API_KEY (add to .env.local)
Endpoints:
  module=account&action=txlist           → address transaction history
  module=stats&action=ethsupply         → ETH supply
  module=gastracker&action=gasoracle    → gas oracle with fast/average/slow
```

**5. DexScreener (token prices, pairs — free)**
```
Base URL: https://api.dexscreener.com/latest/dex
  GET /tokens/{tokenAddresses}           → token pair data
  GET /search?q={query}                  → search pairs
```

### Data Layer Rules

1. **Never fetch in components.** All fetching goes through `/lib/data/` functions.
2. **All API routes validate with Zod.** Input and output schemas.
3. **Cache strategy:**
   - Gas price: 12s (1 block)
   - Protocol TVL: 5min
   - APY data: 15min
   - Historical charts: 1hr
   - Whale transactions: 30s
4. **All API routes have error boundaries** — they return structured errors, never crash.
5. **Stale data UI:** Show last-updated timestamp + yellow warning badge if data is >2x the
   cache TTL old.
6. **SSE endpoint:** `/api/stream` — pushes gas updates, new whale txns, protocol TVL changes.

---

## FILE STRUCTURE

Rebuild to this structure. Migrate existing code where possible, rewrite where broken.

```
baseforge/
├── app/
│   ├── layout.tsx                    # Root layout: fonts, theme, Sentry, QueryProvider
│   ├── page.tsx                      # Overview dashboard (redirect or inline)
│   ├── globals.css                   # Design tokens as CSS variables
│   ├── market/
│   │   └── page.tsx                  # Protocol market table
│   ├── portfolio/
│   │   └── page.tsx                  # Wallet input → portfolio breakdown
│   ├── revenue/
│   │   └── page.tsx                  # Fee and revenue analytics
│   ├── mev/
│   │   └── page.tsx                  # MEV exposure, sandwich data
│   ├── compare/
│   │   └── page.tsx                  # Side-by-side protocol comparison
│   ├── alerts/
│   │   └── page.tsx                  # Alert configuration (localStorage-based)
│   ├── whales/
│   │   └── page.tsx                  # Large wallet tracker
│   ├── risk/
│   │   └── page.tsx                  # Risk scoring dashboard
│   ├── charts/
│   │   └── page.tsx                  # Full-screen chart explorer
│   └── api/
│       ├── health/
│       │   └── route.ts              # Health check with data source status
│       ├── protocols/
│       │   └── route.ts              # Protocol list with TVL, APY, fees
│       ├── protocol/
│       │   └── [slug]/
│       │       └── route.ts          # Single protocol detail
│       ├── tvl/
│       │   └── route.ts              # Base TVL history
│       ├── gas/
│       │   └── route.ts              # Current gas (12s cache)
│       ├── yields/
│       │   └── route.ts              # APY data for Base pools
│       ├── whales/
│       │   └── route.ts              # Recent large transactions
│       ├── fees/
│       │   └── route.ts              # Protocol fee rankings
│       ├── stream/
│       │   └── route.ts              # SSE endpoint
│       └── agents/
│           └── context/
│               └── route.ts          # AI Agent API (properly authed)
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx                # Top nav with live gas badge
│   │   ├── Sidebar.tsx               # Tab navigation
│   │   └── LiveIndicator.tsx         # Pulsing "LIVE" badge
│   ├── overview/
│   │   ├── HeroMetrics.tsx           # TVL, protocols, 24h change, gas
│   │   ├── NetworkSummary.tsx        # Base network stats
│   │   └── TopProtocols.tsx          # Top 10 protocols table
│   ├── market/
│   │   ├── ProtocolTable.tsx         # Sortable, filterable protocol list
│   │   └── ProtocolRow.tsx           # Single protocol row with sparkline
│   ├── charts/
│   │   ├── TVLChart.tsx              # Area chart for TVL history
│   │   ├── VolumeChart.tsx           # Bar chart for DEX volume
│   │   ├── FeesChart.tsx             # Revenue/fees over time
│   │   └── Sparkline.tsx             # Inline mini chart for table rows
│   ├── whales/
│   │   ├── WhaleTable.tsx            # Large transactions feed
│   │   └── WhaleRow.tsx              # Address, amount, protocol, time
│   ├── risk/
│   │   ├── RiskScore.tsx             # Protocol risk gauge
│   │   └── RiskBreakdown.tsx         # Risk factor breakdown
│   ├── shared/
│   │   ├── MetricCard.tsx            # Reusable stat card with skeleton
│   │   ├── SkeletonCard.tsx          # Shimmer loading state
│   │   ├── ErrorCard.tsx             # Graceful error display
│   │   ├── StaleDataBadge.tsx        # Yellow warning for old data
│   │   ├── AddressDisplay.tsx        # Truncated address + copy + Basescan link
│   │   ├── TokenAmount.tsx           # Formatted token + USD value
│   │   └── DeltaBadge.tsx            # +2.4% / -1.3% with color
│   └── portfolio/
│       ├── WalletInput.tsx           # Address input with validation
│       └── PortfolioSummary.tsx      # Position breakdown
│
├── lib/
│   ├── data/
│   │   ├── defillama.ts              # All DefiLlama fetching functions
│   │   ├── gas.ts                    # Gas price via viem
│   │   ├── coingecko.ts              # Price data
│   │   ├── basescan.ts               # Explorer data, whale txns
│   │   └── dexscreener.ts            # Pair and token data
│   ├── schemas/
│   │   ├── protocol.ts               # Zod schemas for protocol data
│   │   ├── gas.ts                    # Zod schemas for gas response
│   │   ├── whale.ts                  # Zod schemas for transactions
│   │   └── agent.ts                  # Zod schemas for agent API
│   ├── risk/
│   │   └── scorer.ts                 # Protocol risk scoring logic
│   ├── utils/
│   │   ├── format.ts                 # formatUSD, formatPercent, formatAddress
│   │   ├── cache.ts                  # In-memory cache utility
│   │   └── cn.ts                     # clsx + tailwind-merge
│   └── constants/
│       ├── protocols.ts              # Known Base protocol slugs + metadata
│       └── chains.ts                 # Chain config
│
├── hooks/
│   ├── useProtocols.ts               # SWR hook for protocol list
│   ├── useGas.ts                     # SWR hook with 12s refresh
│   ├── useTVLHistory.ts              # SWR hook for chart data
│   ├── useWhales.ts                  # SWR hook for whale feed
│   ├── useSSE.ts                     # SSE connection hook
│   └── usePortfolio.ts               # Wallet portfolio hook
│
├── .env.local                        # (create this)
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## ENVIRONMENT VARIABLES

Create `.env.local` with:

```env
# Required
BASESCAN_API_KEY=your_key_here        # Get free at basescan.org/apis

# Optional but recommended
COINGECKO_API_KEY=                    # Free tier works without key
NEXT_PUBLIC_APP_URL=https://baseforge-v1.vercel.app

# AI Agent API auth
AGENT_API_SECRET=generate_a_random_32char_string_here

# Sentry (if configured)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## PHASE-BY-PHASE BUILD PLAN

Execute each phase completely before moving to the next. Do not start Phase 2 with broken
code from Phase 1.

---

### PHASE 1 — Foundation & Data Layer

**Goal:** Every API route returns real, validated data. Zero placeholder values.

#### 1a. Build `lib/utils/format.ts`
```typescript
// Must include:
export function formatUSD(value: number, compact?: boolean): string
export function formatPercent(value: number, decimals?: number): string
export function formatAddress(address: string, chars?: number): string
export function formatNumber(value: number, compact?: boolean): string
export function timeAgo(timestamp: number): string
```

#### 1b. Build `lib/utils/cache.ts`
Simple in-memory cache for API routes:
```typescript
interface CacheEntry<T> { data: T; timestamp: number; ttl: number }
export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  set<T>(key: string, data: T, ttlMs: number): void
  get<T>(key: string): T | null
  isStale(key: string, warnThresholdMultiplier?: number): boolean
}
export const cache = new MemoryCache()
```

#### 1c. Build `lib/data/defillama.ts`
```typescript
// Key functions — all must handle fetch errors gracefully:
export async function getBaseProtocols(): Promise<Protocol[]>
  // Fetch /protocols, filter where chains includes "Base", map to Protocol type

export async function getProtocolDetail(slug: string): Promise<ProtocolDetail>
  // Fetch /protocol/{slug}

export async function getBaseTVLHistory(): Promise<TVLPoint[]>
  // Fetch /v2/historicalChainTvl/Base

export async function getBaseYields(): Promise<YieldPool[]>
  // Fetch /yields/pools, filter chain === "Base"

export async function getBaseFees(): Promise<FeeProtocol[]>
  // Fetch /overview/fees/Base

export async function getBaseDEXVolume(): Promise<DEXSummary>
  // Fetch /overview/dexs/Base
```

#### 1d. Build `lib/data/gas.ts`
```typescript
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org', { timeout: 5000 }),
})

export async function getGasPrice(): Promise<GasData> {
  // Returns: { fast: string, average: string, slow: string, gwei: string }
  // Use eth_gasPrice + Basescan gas oracle as fallback
  // Format as gwei with 4 decimal places
}
```

#### 1e. Build all API routes

For each route, the pattern is:
```typescript
// app/api/protocols/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getBaseProtocols } from '@/lib/data/defillama'
import { cache } from '@/lib/utils/cache'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: Request) {
  try {
    const cached = cache.get<Protocol[]>('protocols')
    if (cached) {
      return NextResponse.json({
        data: cached,
        cached: true,
        timestamp: Date.now(),
      })
    }

    const protocols = await getBaseProtocols()
    const validated = ProtocolArraySchema.parse(protocols)
    cache.set('protocols', validated, CACHE_TTL)

    return NextResponse.json({
      data: validated,
      cached: false,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('[/api/protocols]', error)
    return NextResponse.json(
      { error: 'Failed to fetch protocols', details: String(error) },
      { status: 500 }
    )
  }
}
```

Apply this pattern to all routes. Never let a route throw unhandled.

#### 1f. Build `/api/health/route.ts`
Must check and report status of each upstream:
- DefiLlama: ping /protocols
- Base RPC: call eth_blockNumber  
- Basescan: ping with simple eth_supply call
- CoinGecko: ping /ping

Return:
```json
{
  "status": "healthy" | "degraded" | "down",
  "sources": {
    "defillama": { "ok": true, "latencyMs": 120 },
    "baseRpc": { "ok": true, "latencyMs": 45, "blockNumber": 12345678 },
    "basescan": { "ok": false, "error": "timeout" },
    "coingecko": { "ok": true, "latencyMs": 89 }
  },
  "timestamp": 1234567890
}
```

#### 1g. Build `/api/agents/context/route.ts`
This is the AI Agent API. Make it actually useful.

Auth: Check `Authorization: Bearer {AGENT_API_SECRET}` header. Return 401 if missing/wrong.

Query params:
- `include`: `tvl`, `yields`, `fees`, `whales`, `gas`, `risk`, `all`
- `top`: number of protocols to include (default 10)
- `format`: `json` | `markdown` (default json)

Response (json):
```json
{
  "generated_at": "ISO timestamp",
  "base_network": {
    "total_tvl_usd": 5660000000,
    "total_protocols": 87,
    "24h_tvl_change_pct": 0.27,
    "gas_gwei": "0.0012",
    "latest_block": 12345678
  },
  "top_protocols": [
    {
      "name": "Morpho Blue",
      "slug": "morpho-blue",
      "tvl_usd": 2704120000,
      "24h_change_pct": 1.2,
      "category": "Lending",
      "apy": 5.4,
      "risk_score": 82
    }
  ],
  "yields": { "best_stable_apy": 8.2, "best_eth_apy": 4.1 },
  "recent_whales": [],
  "risk_summary": { "high_risk_protocols": 2, "avg_risk_score": 74 }
}
```

---

### PHASE 2 — Layout & Navigation

Build `app/layout.tsx` with:
- Google Fonts: Space Grotesk (display) + Inter (UI) + JetBrains Mono (mono)
- Dark theme by default, no flash
- QueryClientProvider wrapping children
- Sentry init (if SENTRY_DSN set)
- Navbar at top: BaseForge logo left, live gas price badge center-right, GitHub link right
- Sidebar for desktop: All 10 tabs with icons
- Bottom nav for mobile: Top 5 tabs only

**Navbar gas badge:**
```tsx
// Shows current gas, updates every 12s via useGas() hook
// Green dot pulsing when data is fresh
// Yellow dot when stale (>24s old)
// Format: "0.0012 gwei ●"
```

**Tab icons (use lucide-react):**
- Overview: `LayoutDashboard`
- Market: `BarChart3`
- Portfolio: `Wallet`
- Revenue: `DollarSign`
- MEV: `Zap`
- Compare: `GitCompare`
- Alerts: `Bell`
- Whales: `Fish`
- Risk: `Shield`
- Charts: `TrendingUp`

---

### PHASE 3 — Overview Dashboard (app/page.tsx)

This is the hero. Make it exceptional.

**Hero Metrics Row (4 cards):**
1. **Total TVL** — Base chain TVL from DefiLlama. Skeleton while loading. Format: `$5.66B`
2. **Protocols** — Count of active protocols on Base. Format: `87`
3. **24h Change** — TVL delta. Color: green/red based on sign. Format: `+0.27%`
4. **Gas** — Current Base gas from `useGas()` hook. Format: `0.0012 gwei`

Rules for hero metrics:
- Use `SkeletonCard` while `isLoading`. NEVER render `$0` or `0`.
- Show `ErrorCard` with retry button if fetch fails.
- Show `StaleDataBadge` if data is older than 2× TTL.
- All values animate in on first load (framer-motion, 300ms stagger).

**Network Summary Section:**
Grid of 6 smaller metric cards:
- DEX Volume 24h
- Bridge Inflow 24h
- Active Users 24h (if available)
- Top DEX by volume
- Largest protocol by TVL
- Best yield on Base right now

**Top Protocols Table:**
Columns: Protocol | Category | TVL | 24h Change | 7d Change | APY | Risk Score
- Default sort: TVL descending
- Limit to top 10 on overview (full list on /market)
- Each row has a sparkline (30d TVL mini chart)
- Row click → navigates to /market with protocol selected
- Show protocol icon from `https://icons.llama.fi/{slug}.png`

**Live Feed (right sidebar on desktop, below table on mobile):**
Real-time events via SSE:
- Whale transactions > $1M
- Protocol TVL changes > 5% in 1hr
- Gas spikes

---

### PHASE 4 — Market Page (app/market/page.tsx)

Full sortable, filterable protocol table.

**Filters:**
- Category: All | DEX | Lending | Yield | Bridge | Stablecoin | Other
- TVL range: slider
- APY range: slider
- Search: protocol name

**Columns (all sortable):**
- # | Protocol | Category | TVL | TVL 24h% | TVL 7d% | TVL 30d% | Fees 24h | Revenue 24h | APY | Users 24h

**Protocol detail drawer (slide in from right on row click):**
- Full protocol data
- 30d TVL chart
- Fee/revenue chart
- Token price if applicable
- Links: Official site, DefiLlama, Basescan

---

### PHASE 5 — Whales Page (app/whales/page.tsx)

**Feed of large transactions on Base:**

Fetch from Basescan: transactions above $500K threshold.
For each transaction:
- From address (shortened, with copy + Basescan link)
- To address (protocol name if known, else shortened address)
- Amount in ETH + USD value
- Token (ETH, USDC, etc.)
- Time ago
- Transaction hash link

**Known protocol address map** in `lib/constants/protocols.ts`:
Build a lookup table of known protocol contract addresses → protocol name.
So when a whale interacts with Morpho Blue's contract, show "→ Morpho Blue (Deposit)"
instead of a raw address.

**Whale filter controls:**
- Min amount: $100K / $500K / $1M / $5M+
- Token: All / ETH / USDC / USDT / Other
- Direction: Deposits / Withdrawals / Transfers / All

**Auto-refresh:** Poll every 30 seconds. Show "N new transactions" banner, user clicks to load.

---

### PHASE 6 — Risk Page (app/risk/page.tsx)

**Risk Score algorithm per protocol (0–100, higher = safer):**

```typescript
function scoreProtocol(protocol: ProtocolDetail): RiskScore {
  let score = 100
  const factors: RiskFactor[] = []

  // Audit coverage (0–20 pts)
  if (!protocol.audits?.length) { score -= 20; factors.push({ name: 'No audits', impact: -20 }) }
  else if (protocol.audits.length === 1) { score -= 10; factors.push({ name: 'Single audit', impact: -10 }) }

  // TVL concentration (0–15 pts)
  const tvlShareOfBase = protocol.tvl / baseTotalTVL
  if (tvlShareOfBase > 0.5) { /* systemic risk */ score -= 15 }
  else if (tvlShareOfBase < 0.01) { /* low TVL risk */ score -= 10 }

  // Age (0–15 pts)
  const ageMonths = (Date.now() - protocol.listedAt * 1000) / (30 * 24 * 3600 * 1000)
  if (ageMonths < 3) { score -= 15; factors.push({ name: 'Protocol age < 3 months', impact: -15 }) }
  else if (ageMonths < 6) { score -= 7 }

  // TVL change stability (0–10 pts)
  if (Math.abs(protocol.change_1d) > 20) { score -= 10 }
  else if (Math.abs(protocol.change_7d) > 30) { score -= 7 }

  // Oracle dependency (inferred from category)
  if (['Lending', 'Derivatives'].includes(protocol.category)) {
    score -= 5 // Oracle risk inherent
    factors.push({ name: 'Oracle dependent', impact: -5 })
  }

  return { score: Math.max(0, score), factors, grade: scoreToGrade(score) }
  // Grade: A (85+), B (70-84), C (55-69), D (40-54), F (<40)
}
```

**Risk Dashboard layout:**
- Protocol grid with colored risk gauge (radial chart)
- Risk distribution histogram
- "Highest risk protocols" warning list
- "Safest protocols" recommendation list
- Explanation of each risk factor in plain English

---

### PHASE 7 — Revenue Page (app/revenue/page.tsx)

**Protocol fee and revenue analytics:**
- Fee rankings (who generates most fees)
- Revenue breakdown (fees kept by protocol vs distributed to LPs)
- 30d fee trend chart (area chart, stacked by protocol)
- Fee per $ of TVL ratio (capital efficiency metric)
- Table: Protocol | TVL | Fees 24h | Fees 30d | Revenue 24h | Fee/TVL ratio

---

### PHASE 8 — Compare Page (app/compare/page.tsx)

Side-by-side comparison of 2–4 protocols.

**URL state:** `/compare?a=morpho-blue&b=aave-v3`

**Comparison metrics:**
- TVL + trend
- APY (supply + borrow where applicable)
- Fees generated
- Risk score + breakdown
- Age
- Category
- 30d TVL chart (overlaid lines, different colors)

---

### PHASE 9 — Charts Page (app/charts/page.tsx)

Full-screen chart explorer. Chart selector in sidebar.

**Available charts:**
1. Base Total TVL — 7d / 30d / 90d / 1yr
2. DEX Volume — daily bar chart
3. Bridge Flows — in vs out over time
4. Gas Price — historical (if available from RPC)
5. Protocol TVL — select any protocol, see its TVL history
6. Yield comparison — APY of top 10 pools over time

All charts: Recharts. Area for TVL, Bar for volume, Line for comparisons.
Tooltips: Always show exact values + date.
Zoom: Enable brush selector for date range.

---

### PHASE 10 — SSE Stream (app/api/stream/route.ts)

```typescript
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      // Initial payload
      send('connected', { timestamp: Date.now() })

      // Poll gas every 12s
      const gasInterval = setInterval(async () => {
        const gas = await getGasPrice()
        send('gas', gas)
      }, 12000)

      // Poll whales every 30s
      const whaleInterval = setInterval(async () => {
        const whales = await getRecentWhaleTransactions(500000)
        send('whales', whales)
      }, 30000)

      // Cleanup
      return () => {
        clearInterval(gasInterval)
        clearInterval(whaleInterval)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

---

### PHASE 11 — Portfolio Page (app/portfolio/page.tsx)

**Wallet input:**
- Text input for Base address (0x...) or ENS
- Validate with viem `isAddress()`
- URL state: `/portfolio?address=0x...`

**Data to show:**
- ETH balance + USD value
- ERC20 token balances (via Basescan token balance API)
- Protocol positions (if address has interacted with top protocols, show estimated position)
- Transaction history (last 20 txns)

Note: Full DeFi position tracking requires subgraph queries per protocol.
For v1, focus on: ETH balance, major ERC20s, transaction history.
Label transactions with protocol names from the constants map.

---

### PHASE 12 — Alerts Page (app/alerts/page.tsx)

localStorage-based alerts (no backend needed for v1).

**Alert types:**
- TVL threshold: "Alert me when [Protocol] TVL drops below $X"
- Gas threshold: "Alert me when gas is below X gwei"
- Whale alert: "Alert me for whale transactions > $X on [Protocol]"

**Implementation:**
- Store alerts in localStorage as JSON array
- Check alerts on each SSE message
- Show toast notification using a simple custom toast component
- Alert history: last 20 triggered alerts

---

## PRODUCTION HARDENING CHECKLIST

Apply these to every API route before considering it done:

- [ ] Zod validation on all inputs (query params, body)
- [ ] Zod validation on all external API responses (strip unknown fields, coerce types)
- [ ] Try/catch wrapping all external fetch calls
- [ ] Cache with TTL
- [ ] Stale data detection
- [ ] Proper HTTP status codes (200, 400, 401, 404, 500, 503)
- [ ] Request deduplication (don't fire two identical fetches simultaneously)
- [ ] Timeout on external fetches (5s default, 10s max)
- [ ] Rate limit headers (add `X-RateLimit-*` headers where applicable)
- [ ] CORS headers for AI Agent API routes

Apply these to every component before considering it done:

- [ ] Loading skeleton (no flash of $0 or empty)
- [ ] Error state with retry button
- [ ] Stale data badge
- [ ] Mobile responsive (test at 375px)
- [ ] Tooltip explaining each metric
- [ ] All numbers formatted with formatUSD / formatPercent / formatNumber

---

## CONSTRAINTS & RULES FOR CLAUDE CODE

1. **Never hardcode data.** Every value on screen must come from a real API call.
2. **Never use placeholder text** like "Loading..." as final state — use skeletons.
3. **Never commit API keys.** Use `.env.local` and reference via `process.env`.
4. **Never build a feature that isn't wired end-to-end.** If the API isn't ready, build the API first. If the data doesn't exist, note it and skip the feature for now.
5. **TypeScript strict mode.** No `any`. No `// @ts-ignore`.
6. **Component files under 200 lines.** Split if they get longer.
7. **Test each phase** by running `npm run dev` and checking the actual routes in browser before starting next phase.
8. **Mobile is not an afterthought.** Every layout must work at 375px.

---

## HOW TO START EACH SESSION

At the start of every Claude Code session, run:

```bash
cd baseforge
git status
git log --oneline -5
npm run dev &
curl -s localhost:3000/api/health | python3 -m json.tool
```

This tells you: current branch state, last 5 commits, whether the dev server starts, and
whether all data sources are reachable. Fix health issues before writing any new features.

---

## DEPLOY

When ready to deploy:

```bash
# Verify build
npm run build

# Check for type errors
npx tsc --noEmit

# Push to trigger Vercel deploy
git add -A
git commit -m "feat: [describe what you built]"
git push origin main
```

After deploy, check:
1. `https://baseforge-v1.vercel.app/api/health` — all green
2. `https://baseforge-v1.vercel.app/` — hero metrics show real data, no $0
3. `https://baseforge-v1.vercel.app/market` — protocol table populated
4. `https://baseforge-v1.vercel.app/whales` — live feed showing transactions

---

*This document is the source of truth for the BaseForge rebuild. When in doubt, follow this.
When something in this doc conflicts with the existing codebase, this doc wins.*
