# Production Stabilization Checklist

Apply these on the **Vercel** project for `baseforge-v1` after merging/deploying the stabilization changes.

## Required environment variables

| Variable | Value | Why |
|----------|-------|-----|
| `DATABASE_URL` | Neon connection string | Shared cache, rate limits, alerts |
| `ENVIO_API_TOKEN` | From envio.dev | Primary indexer |
| `ETHERSCAN_API_KEY` | From etherscan.io | Fallback indexer |
| `CACHE_BACKEND` | `postgres` or **unset** | Auto-uses postgres when `DATABASE_URL` is set in production |
| `CRON_SECRET` | Random 32+ byte hex | Authorizes Vercel Cron cache warmer |

**Remove or ignore:** `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, `CACHE_BACKEND=memory` in production.

## Vercel Cron (replaces missing worker)

`vercel.json` schedules `GET /api/cron/warm` every **2 minutes**.

1. Set `CRON_SECRET` in Vercel → Settings → Environment Variables (Production).
2. Redeploy — Vercel injects `Authorization: Bearer <CRON_SECRET>` on cron invocations.
3. Do **not** set `WORKER_URL` unless you deploy the Fly/Railway worker.

## Optional: dedicated worker

```bash
cd worker && fly deploy   # or Railway with worker/Dockerfile
```

Then set `WORKER_URL=https://<your-worker-host>` (no trailing slash).

## Verify after deploy

```bash
curl -s https://baseforge-v1.vercel.app/api/health | jq
```

Expected when stable:

- `status`: `"ok"` or `"degraded"` (not `"unhealthy"`)
- `checks.defillama.status`: `"ok"`
- `checks.cache.detail`: `backend=postgres`
- `checks.worker.detail`: mentions `vercel-cron` OR `railway worker healthy`

Manual cron test (local or staging):

```bash
curl -s "https://baseforge-v1.vercel.app/api/cron/warm" \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```