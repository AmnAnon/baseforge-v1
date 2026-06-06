# Production Stabilization Checklist

Apply these on the **Vercel** project for `baseforge-v1` after merging/deploying the stabilization changes.

## Critical: Vercel serverless cache

**Do not use `CACHE_BACKEND=memory` on Vercel.** Each serverless function instance has its own isolated memory — cache writes on one instance are invisible to the next request. That causes cache misses, stampedes on upstream APIs, and inconsistent API responses.

BaseForge auto-selects **postgres** when:

- `DATABASE_URL` is set, or
- The deploy runs on Vercel (`VERCEL=1`), or
- `NODE_ENV=production`

Without `DATABASE_URL` on Vercel, `/api/health` reports `checks.cache.status: "error"` and overall status degrades to `unhealthy`.

## Required environment variables

| Variable | Value | Why |
|----------|-------|-----|
| `DATABASE_URL` | Neon connection string | **Shared** cache + rate limits across all Vercel instances |
| `ENVIO_API_TOKEN` | From envio.dev | Primary indexer |
| `ETHERSCAN_API_KEY` | From etherscan.io | Fallback indexer |
| `CACHE_BACKEND` | `postgres` or **unset** | Auto-uses postgres on Vercel/production when `DATABASE_URL` is set |
| `CRON_SECRET` | Random 32+ byte hex | Authorizes Vercel Cron cache warmer |

**Remove or ignore:** `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, `CACHE_BACKEND=memory` on Vercel/production.

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

## Worker URL (VPS)

If using the Tencent VPS worker (see `WORKER_VPS.md`), Production **must** use the proxied path:

```env
WORKER_URL=http://43.163.106.68/baseforge
```

(No trailing slash. Health probe: `http://43.163.106.68/baseforge/health` → `{"status":"ok",...}`.)

If `WORKER_URL` is wrong (e.g. missing `/baseforge`), health reports `worker` → `HTTP 404`.

**Alternative:** Unset `WORKER_URL`, set `CRON_SECRET`, and rely on Vercel Cron only.

## Verify after deploy

```bash
curl -s https://baseforge-v1.vercel.app/api/health | jq
```

Expected when stable:

- `status`: `"ok"` or `"degraded"` (not `"unhealthy"`)
- `checks.defillama.status`: `"ok"`
- `checks.cache.detail`: `backend=postgres`
- `checks.worker.detail`: mentions `vercel-cron` OR `railway worker healthy`

Track phased work in `docs/V2_ROADMAP.md` (Phase 0 verification log).

Manual cron test (local or staging):

```bash
curl -s "https://baseforge-v1.vercel.app/api/cron/warm" \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```