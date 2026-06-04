# BaseForge Worker on VPS

Deploy the background worker on any Ubuntu VPS (tested on `ubuntu@43.163.106.68`).

## What the worker does

| Loop | Interval |
|------|----------|
| Cache warmer | 30s |
| Risk scorer | 5min |
| Whale persister | 5min |
| Alert evaluator | 60s |
| HTTP | always — `:3001/health`, `:3001/metrics` |

## One-time setup

```bash
# On the VPS — create secrets (same Neon URL as Vercel)
mkdir -p ~/.secrets && chmod 700 ~/.secrets
nano ~/.secrets/baseforge.env
```

```bash
DATABASE_URL=postgresql://...@....neon.tech/neondb?sslmode=require
```

```bash
cd ~/baseforge-v1
source ~/.secrets/baseforge.env
export DATABASE_URL
bash scripts/vps-deploy-worker.sh
```

Or from your laptop (paste URL once):

```bash
ssh ubuntu@43.163.106.68 "mkdir -p ~/.secrets && printf '%s\n' 'DATABASE_URL=YOUR_URL_HERE' 'METRICS_PORT=3001' 'NODE_ENV=production' > ~/.secrets/baseforge.env && chmod 600 ~/.secrets/baseforge.env && source ~/.secrets/baseforge.env && cd ~/baseforge-v1 && git pull && bash scripts/vps-deploy-worker.sh"
```

## Vercel

After the worker is healthy:

```env
WORKER_URL=http://43.163.106.68:3001
```

Redeploy or wait for env propagation. Health should show `checks.worker.status: ok`.

## Ops

```bash
sudo systemctl status baseforge-worker
sudo journalctl -u baseforge-worker -f
curl -s http://127.0.0.1:3001/health | jq
curl -s http://127.0.0.1:3001/metrics | head
```

## Railway

Not required. This VPS replaces Railway/Fly for the worker process.