# Setup Guide

## Prerequisites

- **Node.js** 20+ (for BigInt support and Next.js 16 compatibility)
- **npm** 9+ (comes with Node.js 20)
- **Git**

Optional:
- **Docker** (for containerized deployment)
- **PostgreSQL** or a Neon account (for alerts and frame analytics)

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/AmnAnon/baseforge.git
cd baseforge
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
# Required for full functionality
ETHERSCAN_API_KEY=your-etherscan-v2-key     # https://etherscan.io/myapikey
DATABASE_URL=postgresql://...               # https://console.neon.tech
ENVIO_API_TOKEN=your-envio-token            # https://envio.dev

# Optional but recommended
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

**Minimum viable setup** (no API keys): The app will run with DefiLlama data only. Whale tracking and lending events will show empty data. The indexer will use the Etherscan fallback (which also needs a key).

### 3. Set up database (optional)

If you have a Postgres connection:

```bash
npm run db:push        # Push schema to database
npm run db:studio      # Open Drizzle Studio (visual DB browser)
```

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dev server uses Turbopack for fast hot module replacement.

### 5. Run tests

```bash
npm run test           # Run all tests once
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

### 6. Lint and typecheck

```bash
npm run lint           # ESLint
npx tsc --noEmit       # TypeScript check
```

---

## Docker

### Build and run

```bash
docker build -t baseforge .
docker run -p 3000:3000 \
  -e ETHERSCAN_API_KEY=your-key \
  -e DATABASE_URL=postgresql://... \
  -e ENVIO_API_TOKEN=your-token \
  baseforge
```

### Docker Compose (example)

```yaml
version: "3.8"
services:
  baseforge:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ETHERSCAN_API_KEY=${ETHERSCAN_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - ENVIO_API_TOKEN=${ENVIO_API_TOKEN}
      - NEXT_PUBLIC_BASE_URL=https://your-domain.com
    restart: unless-stopped
```

### Dockerfile notes

- Multi-stage build (deps → build → production)
- Uses `output: "standalone"` for minimal production bundle
- Non-root `nextjs` user (UID 1001)
- Only `server.js`, `.next/static`, and `public/` in final image
- ~150MB final image size

---

## Production (Vercel)

### One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAmnAnon%2Fbaseforge&env=ETHERSCAN_API_KEY,DATABASE_URL,ENVIO_API_TOKEN&envDescription=See%20.env.example%20for%20all%20variables&project-name=baseforge)

### Manual deploy

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard:

| Variable | Required | Description |
|---|---|---|
| `ETHERSCAN_API_KEY` | Yes | Etherscan V2 key for fallback data |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `ENVIO_API_TOKEN` | Recommended | Envio HyperSync for primary indexing |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry error tracking |
| `NEXT_PUBLIC_BASE_URL` | Auto-set | Your deployment URL |
| `NEXT_PUBLIC_DEMO_MODE` | Optional | Show demo banner (auto-true on Vercel) |
| `ADMIN_KEY` | Optional | Gate admin analytics endpoint |
| `NEYNAR_API_KEY` | Optional | Farcaster social data |
| `CACHE_BACKEND` | Optional | `memory` (default) or `upstash` |
| `UPSTASH_REDIS_URL` | Optional | Distributed cache |
| `UPSTASH_REDIS_TOKEN` | Optional | Distributed cache auth |

3. Deploy. Vercel automatically detects Next.js and runs `npm run build`.

### Vercel-specific notes

- **Serverless functions:** API routes run as serverless functions with 10s timeout (default). The SSE stream route caps at 5 minutes.
- **Edge functions:** OG image routes (`/api/og/*`) run at the edge for low latency.
- **ISR:** Not used — all API routes are `force-dynamic`.
- **VERCEL_URL:** Automatically set by Vercel. Used as fallback for `NEXT_PUBLIC_BASE_URL`.

---

## Production (Self-hosted)

### Build for production

```bash
npm run build
```

This generates a standalone server in `.next/standalone/`.

### Run production server

```bash
# Set env vars
export NODE_ENV=production
export ETHERSCAN_API_KEY=...
export DATABASE_URL=...

# Start server
node .next/standalone/server.js
```

### With a process manager (pm2)

```bash
npm install -g pm2

pm2 start .next/standalone/server.js --name baseforge \
  --env production \
  --max-memory-restart 512M
```

### Behind a reverse proxy (nginx)

```nginx
server {
    listen 80;
    server_name baseforge.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## Environment Variable Reference

Full list in `.env.example`. Quick reference:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ETHERSCAN_API_KEY` | Yes | — | Etherscan V2 multi-chain API key |
| `DATABASE_URL` | Yes* | — | Neon Postgres connection string |
| `ENVIO_API_TOKEN` | Recommended | — | Envio HyperSync API token |
| `NEXT_PUBLIC_BASE_URL` | Auto | `http://localhost:3000` | Deployment URL |
| `NEXT_PUBLIC_SENTRY_DSN` | No | — | Sentry error tracking DSN |
| `NEXT_PUBLIC_DEMO_MODE` | No | `false` | Show demo banner |
| `CACHE_BACKEND` | No | `memory` | `memory` or `upstash` |
| `UPSTASH_REDIS_URL` | No | — | Upstash Redis URL |
| `UPSTASH_REDIS_TOKEN` | No | — | Upstash Redis auth token |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `ADMIN_KEY` | No | — | Admin analytics auth key |
| `ADMIN_FID` | No | — | Admin Farcaster FID |
| `NEYNAR_API_KEY` | No | — | Farcaster social data |
| `BASE_CHAIN_ID` | No | `8453` | Base chain ID |

*DATABASE_URL is required for alerts and frame analytics. The app starts without it but those features return errors.

---

## Troubleshooting

### App crashes on startup

**"DATABASE_URL is required"** — The DB client is lazy-initialized. This error only appears when a route that needs Postgres is actually called. Check that `DATABASE_URL` is set in your environment.

### Empty whale/swap data

Check that either `ENVIO_API_TOKEN` or `ETHERSCAN_API_KEY` is set. Without both, on-chain data endpoints return empty arrays.

### Rate limiting in development

Rate limiting is disabled when `NODE_ENV !== "production"`. Next.js dev mode sets `NODE_ENV=development` automatically.

### OG images fail

OG image routes run on the edge runtime. They need the `@vercel/og` package and have a 4-second timeout for external API calls. If DefiLlama is slow, static fallback values are used.

### Build fails with BigInt errors

Ensure `tsconfig.json` has `"target": "ES2020"` or higher. The indexer layer uses BigInt for EVM uint256 decoding.
