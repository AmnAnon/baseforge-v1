# BaseForge Worker

Background worker that runs four perpetual loops alongside the Next.js app:

| Loop | Interval | What | 
|------|----------|------|
| Cache Warmer | 30s | Fetches DefiLlama, CoinGecko → Upstash Redis |
| Risk Scorer | 5min | Computes protocol health scores → Redis + Neon |
| Whale Persister | 5min | Batches whale events → Neon Postgres |
| Alert Evaluator | 60s | Checks alert rules → webhook |
| HTTP server | always | `/metrics`, `/health`, `POST /events/whale` |

## Running Locally

### 1. Configure environment

```bash
cp worker/.env.example worker/.env.local
```

Edit `worker/.env.local` with your Upstash Redis and Neon credentials.

### 2. Install dependencies

```bash
cd worker && npm install
```

### 3. Run (two options)

**Option A: Worker only (for testing)**
```bash
npm run dev:worker
```

**Option B: Worker + Next.js together**
```bash
npm run dev:all
```

The worker starts on port 3001 by default (override with `METRICS_PORT`).

## Why a Worker?

The Next.js API routes fetch live data on every request. The worker pre-warms the Redis cache so the dashboard loads fast — first-visit latency drops from ~3s to ~200ms.

## History

Previously deployed on Railway (via `railway.json` + Dockerfile).  
Moved to local dev to avoid Railway credit costs.
