// worker/index.ts
// BaseForge standalone Railway worker — Postgres-Only Edition.
// Runs four perpetual loops:
//   1. Cache Warmer      — 30s  — fetches DefiLlama/CoinGecko → Postgres api_cache
//   2. Risk Scorer       — 5min — computes health scores → Neon
//   3. Whale Persister   — 5min — events → Neon + netflows → Postgres api_cache
//   4. Alert Evaluator   — 60s  — checks alert rules → webhook + Neon
//   5. HTTP server       — always — /metrics (Prometheus), /health, POST /events/whale

import http from "node:http";
import * as promClient from "prom-client";
import { neon } from "@neondatabase/serverless";
import { validateWebhookUrlSync } from "./webhook-url";

// ─── Environment ─────────────────────────────────────────────────
const DATABASE_URL        = process.env.DATABASE_URL         ?? "";
const METRICS_PORT        = Number(process.env.METRICS_PORT ?? 3001);

if (!DATABASE_URL) {
  console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg: "Missing DATABASE_URL", source: "boot" }));
  process.exit(1);
}

// ─── Neon SQL client ─────────────────────────────────────────────
function buildDbUrl(url: string): string {
  if (url.includes("pgbouncer=true")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true&connection_limit=1`;
}
const sql = neon(buildDbUrl(DATABASE_URL));

// ─── Cache Helpers (Postgres-backed) ───────────────────────────
async function setCache(key: string, value: unknown, ttlSec: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  try {
    await sql`
      INSERT INTO api_cache (key, value, expires_at, created_at)
      VALUES (${key}, ${JSON.stringify(value)}, ${expiresAt}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    `;
  } catch (err) {
    log("error", "setCache failed", { key, error: String(err) });
  }
}

async function getCache<T>(key: string): Promise<T | null> {
  try {
    const rows = await sql`
      SELECT value, expires_at FROM api_cache WHERE key = ${key} LIMIT 1
    `;
    if (rows.length === 0) return null;
    const entry = rows[0] as { value: string | T; expires_at: string };
    if (new Date() > new Date(entry.expires_at)) return null;
    return typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
  } catch (err) {
    log("error", "getCache failed", { key, error: String(err) });
    return null;
  }
}

async function incrementStreamVersion(): Promise<number> {
  try {
    const rows = await sql`
      INSERT INTO api_cache (key, value, expires_at)
      VALUES ('stream:version', '1'::jsonb, '2099-01-01')
      ON CONFLICT (key) DO UPDATE SET
        value = to_jsonb(
          COALESCE((api_cache.value #>> '{}')::int, 0) + 1
        ),
        expires_at = '2099-01-01'
      RETURNING value
    `;
    const raw = rows[0].value;
    return typeof raw === "number" ? raw : parseInt(String(raw), 10);
  } catch (err) {
    log("error", "incrementStreamVersion failed", { error: String(err) });
    return 0;
  }
}

// ─── Prometheus metrics ──────────────────────────────────────────
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const mUptime = new promClient.Gauge({
  name: "baseforge_uptime_seconds",
  help: "Process uptime in seconds",
  registers: [register],
});

const mCacheSize = new promClient.Gauge({
  name: "baseforge_cache_size_sql",
  help: "Count of rows in api_cache table",
  registers: [register],
});

const mTicks = new promClient.Counter({
  name: "baseforge_worker_ticks_total",
  help: "Total cache-warmer ticks executed",
  registers: [register],
});

const mApiErrors = new promClient.Counter({
  name: "baseforge_api_errors_total",
  help: "Total API fetch errors",
  labelNames: ["source"] as const,
  registers: [register],
});

// ─── Logging helpers ─────────────────────────────────────────────
type LogLevel = "info" | "warn" | "error" | "debug";
function log(level: LogLevel, msg: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...extra }));
}

// ─── Fetch with latency logging ───────────────────────────────────
async function timedFetch(url: string, source: string, init?: RequestInit): Promise<Response> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    log("debug", `fetch ok`, { source, url, latencyMs: Date.now() - t0, status: res.status });
    return res;
  } catch (err) {
    mApiErrors.inc({ source });
    log("error", `fetch failed`, { source, url, latencyMs: Date.now() - t0, error: String(err) });
    throw err;
  }
}

const BASE_TOKEN_IDS = [
  "ethereum", "aerodrome-finance", "moonwell-artemis", "seamless-protocol",
  "uniswap", "aave", "compound-governance-token", "morpho", "pendle",
].join(",");

// ─── Health score logic ─────────────────────────────────────────
// IMPORTANT: Keep in sync with src/lib/risk.ts (calculateHealthScore + thresholds).
// Worker is standalone (no shared src import); duplicate the pure function here.
// On-chain fields (swapVolume etc) are optional and currently not populated in worker scorer
// (worker focuses on DefiLlama for background; main API enriches via indexer).
interface ProtoForScore {
  name: string; audits: number; tvl: number;
  tvlChange24h: number; tvlChange7d: number;
  category: string; oracles: string[];
  forkedFrom?: string[]; apy?: number;
  swapVolume24h?: number;
  netFlow24h?: number;
  uniqueTraders24h?: number;
}

const CATEGORY_BASELINE: Record<string, number> = {
  "Lending": 15, "Dexes": 15, "Liquid Staking": 20, "CDP": 15,
  "Yield": 5, "Bridge": 0, "Derivatives": 10, "Options": 8,
};
const RISK_THRESHOLDS = {
  MAX_TVL_DROP_7D: 0.25,
  MAX_TVL_DROP_24H: 0.1,
  MIN_AUDITS: 1,
  MIN_ORACLES: 2,
  SUSPICIOUS_APY: 1000,
  LOW_VOLUME_RATIO: 0.001,
  HIGH_OUTFLOW_RATIO: 0.1,
};

function calculateHealthScore(proto: ProtoForScore): { score: number; riskFactors: string[] } {
  let score = 50;
  const riskFactors: string[] = [];
  score += proto.audits * 5;
  if (proto.audits < RISK_THRESHOLDS.MIN_AUDITS) { riskFactors.push("No audits"); score -= 15; }
  score += CATEGORY_BASELINE[proto.category] ?? 5;
  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  else { riskFactors.push("Low TVL"); score -= 10; }
  if (Math.abs(proto.tvlChange7d) > RISK_THRESHOLDS.MAX_TVL_DROP_7D * 100) { riskFactors.push("High TVL volatility"); score -= 15; }
  else if (proto.tvlChange7d < -10) { riskFactors.push("TVL declining"); score -= 8; }
  if (Math.abs(proto.tvlChange24h) > RISK_THRESHOLDS.MAX_TVL_DROP_24H * 100) { riskFactors.push("Extreme 24h TVL swing"); score -= 10; }
  if (proto.oracles.length < RISK_THRESHOLDS.MIN_ORACLES) { riskFactors.push("Limited oracle diversity"); score -= 5; }
  if (proto.forkedFrom?.length) score += 3;
  if ((proto.apy ?? 0) > RISK_THRESHOLDS.SUSPICIOUS_APY) { riskFactors.push("Suspiciously high APY"); score -= 10; }

  // On-chain signals (noop unless provided)
  if (proto.swapVolume24h !== undefined && proto.tvl > 0) {
    const vr = proto.swapVolume24h / proto.tvl;
    if (vr > 0.01) score += 5;
    else if (vr < RISK_THRESHOLDS.LOW_VOLUME_RATIO && proto.category === "Dexes") {
      riskFactors.push("Very low trading volume relative to TVL"); score -= 5;
    }
  }
  if (proto.netFlow24h !== undefined && proto.tvl > 0) {
    const or = -proto.netFlow24h / proto.tvl;
    if (or > RISK_THRESHOLDS.HIGH_OUTFLOW_RATIO) { riskFactors.push("Significant net outflows (>10% TVL)"); score -= 10; }
    else if (proto.netFlow24h > 0) score += 3;
  }
  if (proto.uniqueTraders24h !== undefined) {
    if (proto.uniqueTraders24h > 100) score += 3;
    else if (proto.uniqueTraders24h > 10) score += 1;
    else if (proto.uniqueTraders24h === 0 && proto.category === "Dexes") {
      riskFactors.push("Zero unique traders in 24h"); score -= 5;
    }
  }

  return { score: Math.max(0, Math.min(100, score)), riskFactors };
}

function getBaseTvl(p: { chainTvls?: Record<string, number> }): number {
  return p.chainTvls?.["Base"] ?? p.chainTvls?.["base"] ?? p.chainTvls?.["BASE"] ?? 0;
}

// ─── DB bootstrap ────────────────────────────────────────────────
async function bootstrapTables(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS api_cache (
        id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        key         TEXT NOT NULL,
        value       JSONB NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS api_cache_key_idx ON api_cache (key)`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS risk_snapshots (
        id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        protocol    TEXT NOT NULL,
        score       INTEGER NOT NULL,
        health      INTEGER NOT NULL,
        tvl         NUMERIC(20, 2) NOT NULL DEFAULT 0,
        risk_factors JSONB NOT NULL DEFAULT '[]',
        timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS risk_snapshots_protocol_ts_idx ON risk_snapshots (protocol, timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS risk_snapshots_timestamp_idx ON risk_snapshots (timestamp)`;
    // NOTE: Full schema (incl. api_keys, alert_*, whale_events extra cols, etc.) lives in src/lib/db/schema.ts.
    // Run `npm run db:push` / `db:generate` / `db:migrate` from app root for complete/prod alignment.
    // Worker bootstrap ensures the tables *it* writes to.

    await sql`
      CREATE TABLE IF NOT EXISTS whale_events (
        id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        protocol     TEXT NOT NULL,
        action       TEXT NOT NULL,
        usd_value    NUMERIC(20, 2) NOT NULL,
        wallet       TEXT NOT NULL,
        block_number BIGINT,
        tx_hash      TEXT NOT NULL,
        net_flow_direction TEXT NOT NULL,
        timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source       TEXT NOT NULL DEFAULT 'envio'
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS whale_events_tx_hash_idx ON whale_events (tx_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS whale_events_protocol_ts_idx ON whale_events (protocol, timestamp)`;

    log("info", "Postgres tables bootstrapped", { source: "boot" });
  } catch (err) {
    log("error", "DB bootstrap failed", { source: "boot", error: String(err) });
  }
}

// ─── 1. CACHE WARMER ─────────────────────────────────────────────
async function runCacheWarmer(): Promise<void> {
  const t0 = Date.now();
  const updatedKeys: string[] = [];

  let streamProtocols: Array<{ id: string; name: string; tvl: number; change24h: number; logo: string; category: string }> = [];
  let streamTvlHistory: Array<{ date: string; tvl: number }> = [];
  let streamTotalTvl = 0;
  let streamChange24h = 0;
  let streamPrices: Record<string, { usd: number; usd_24h_change?: number }> = {};

  // --- DefiLlama protocols ---
  try {
    const res = await timedFetch("https://api.llama.fi/protocols", "defillama-protocols");
    if (res.ok) {
      const raw: any[] = await res.json();
      const EXCLUDED = new Set(["CEX", "Chain"]);
      const base20 = raw
        .filter((p) => p.chains?.includes("Base") === true && !EXCLUDED.has(p.category ?? ""))
        .sort((a, b) => getBaseTvl(b) - getBaseTvl(a))
        .slice(0, 20)
        .map((p) => ({
          id: p.slug ?? p.name.toLowerCase().replace(/ /g, "-"),
          name: p.name,
          slug: p.slug,
          category: p.category ?? "DeFi",
          tvl: getBaseTvl(p),
          tvlChange24h: p.change_1d ?? 0,
          tvlChange7d: p.change_7d ?? 0,
          logo: p.logo,
        }));
      await setCache("baseforge:protocols", base20, 60);
      updatedKeys.push("protocols");

      streamTotalTvl = base20.reduce((s, p) => s + p.tvl, 0);
      streamProtocols = base20.map((p) => ({
        id: p.id, name: p.name, tvl: p.tvl, change24h: p.tvlChange24h,
        logo: p.logo ?? `https://icons.llama.fi/icons/protocols/${p.id}`,
        category: p.category,
      }));
    }
  } catch {}

  // --- DefiLlama TVL history ---
  try {
    const res = await timedFetch("https://api.llama.fi/v2/historicalChainTvl/Base", "defillama-tvl");
    if (res.ok) {
      const raw: Array<{ date: number; tvl: number }> = await res.json();
      await setCache("baseforge:tvl_history", raw, 300);
      updatedKeys.push("tvl_history");

      if (raw.length >= 2) {
        const latest = raw[raw.length - 1].tvl;
        const prev   = raw[raw.length - 2].tvl;
        streamChange24h = prev > 0 ? Math.round(((latest - prev) / prev) * 10000) / 100 : 0;
      }
      streamTvlHistory = raw.slice(-60).map((d) => ({
        date: new Date(d.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tvl:  d.tvl,
      }));
    }
  } catch {}

  // --- CoinGecko prices ---
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${BASE_TOKEN_IDS}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const res = await timedFetch(url, "coingecko-prices");
    if (res.ok) {
      const raw: Record<string, { usd: number; usd_24h_change?: number }> = await res.json();
      await setCache("baseforge:prices", raw, 30);
      updatedKeys.push("prices");
      streamPrices = raw;
    }
  } catch {}

  // Assembler stream:latest
  if (streamProtocols.length > 0) {
    try {
      const streamPayload = {
        analytics: {
          baseMetrics: { totalTvl: streamTotalTvl, totalProtocols: streamProtocols.length, avgApy: 0, change24h: streamChange24h },
          tvlHistory: streamTvlHistory, protocols: streamProtocols, protocolData: {}, timestamp: Date.now(),
        },
        prices: streamPrices, whales: [], timestamp: Date.now(), _source: "worker",
      };
      await setCache("stream:latest", streamPayload, 120);
      await incrementStreamVersion();
      log("debug", "stream:latest published to Postgres", { source: "cache-warmer" });
    } catch (err) {
      log("warn", "stream:latest write failed", { source: "cache-warmer", error: String(err) });
    }
  }

  try {
    const rows = await sql`SELECT COUNT(*) FROM api_cache`;
    mCacheSize.set(parseInt(rows[0].count as string, 10));
  } catch {}

  mTicks.inc();
  mUptime.set(process.uptime());
  log("info", "cache warmer tick complete", { source: "cache-warmer", latencyMs: Date.now() - t0, keys: updatedKeys });
}

// ─── 2. RISK SCORER ──────────────────────────────────────────────
async function runRiskScorer(): Promise<void> {
  const t0 = Date.now();
  try {
    const protocols = await getCache<Array<{ id: string; name: string; category: string; tvl: number; tvlChange24h: number; tvlChange7d: number }>>("baseforge:protocols");
    if (!protocols) return;

    const scores = protocols.map((p) => {
      const { score, riskFactors } = calculateHealthScore({
        name: p.name, audits: 0, tvl: p.tvl, tvlChange24h: p.tvlChange24h, tvlChange7d: p.tvlChange7d,
        category: p.category, oracles: [],
      });
      return { protocol: p.id, name: p.name, tvl: p.tvl, score, health: score, riskFactors };
    });

    await setCache("risk:scores", scores, 300);

    for (const s of scores) {
      try {
        await sql`
          INSERT INTO risk_snapshots (protocol, score, health, tvl, risk_factors, timestamp)
          VALUES (${s.protocol}, ${s.score}, ${s.health}, ${s.tvl}, ${JSON.stringify(s.riskFactors)}, NOW())
        `;
      } catch {}
    }

    log("info", "risk scorer complete", { source: "risk-scorer", latencyMs: Date.now() - t0, count: scores.length });
  } catch (err) {
    log("error", "risk scorer failed", { source: "risk-scorer", error: String(err) });
  }
}

// ─── 3. WHALE EVENT PERSISTER ────────────────────────────────────
async function runWhaleEventPersister(): Promise<void> {
  const t0 = Date.now();
  try {
    let events: any[] = [];
    try {
      const res = await timedFetch("https://api.eigenphi.io/ethereum/v1/mev/txs/latest?chain=base&limit=100", "eigenphi-whales");
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json.data ?? json.txs ?? []);
        events = rows.map((r: any) => ({
          txHash: String(r.tx_hash ?? r.txHash ?? ""),
          blockNumber: r.blockNumber ? Number(r.blockNumber) : undefined,
          amountUSD: Number(r.profit_usd ?? r.profitUsd ?? 0),
          protocol: String(r.protocol ?? "unknown"),
          sender: String(r.attackerAddress ?? r.attacker_address ?? ""),
          eventType: "swap",
          timestamp: r.timestamp ? Number(r.timestamp) : Math.floor(Date.now() / 1000),
        })).filter((e: any) => e.txHash.length > 10);
      }
    } catch {}

    if (events.length === 0) return;

    let inserted = 0;
    for (const ev of events) {
      const tsMs = (ev.timestamp ?? 0) > 1e12 ? (ev.timestamp ?? 0) : (ev.timestamp ?? 0) * 1000;
      try {
        await sql`
          INSERT INTO whale_events (protocol, action, usd_value, wallet, block_number, tx_hash, net_flow_direction, timestamp, source)
          VALUES (${ev.protocol}, ${ev.eventType}, ${Math.abs(ev.amountUSD)}, ${ev.sender}, ${ev.blockNumber ?? null}, ${ev.txHash}, 'in', ${new Date(tsMs).toISOString()}, 'eigenphi')
          ON CONFLICT (tx_hash) DO NOTHING
        `;
        inserted++;
      } catch {}
    }

    log("info", "whale events persisted", { source: "whale-persister", inserted, total: events.length, latencyMs: Date.now() - t0 });
  } catch (err) {
    log("error", "whale persister failed", { source: "whale-persister", error: String(err) });
  }
}

// ─── 4. ALERT EVALUATOR ──────────────────────────────────────────
async function runAlertEvaluator(): Promise<void> {
  const t0 = Date.now();
  try {
    const rules = await sql`SELECT * FROM alert_rules WHERE enabled = true` as any[];
    if (!rules.length) return;

    const protocols = await getCache<any[]>("baseforge:protocols");
    if (!protocols) return;
    const protoMap = new Map(protocols.map((p) => [p.id, p]));

    for (const rule of rules) {
      try {
        const proto = protoMap.get(rule.protocol);
        if (!proto) continue;
        const threshold = parseFloat(rule.threshold);
        let currentValue: number | null = null;
        let triggered = false;

        if (rule.type === "tvl_drop") {
          currentValue = proto.tvlChange24h;
          triggered = rule.condition === "below" ? currentValue < -threshold : currentValue > threshold;
        } else if (rule.type === "health_decrease") {
          const scores = await getCache<any[]>("risk:scores");
          const entry = scores?.find((s) => s.protocol === rule.protocol);
          if (entry) { currentValue = entry.score; triggered = currentValue < threshold; }
        }

        if (!triggered || currentValue === null) continue;

        const cutoff = new Date(Date.now() - (rule.cooldown_minutes ?? 60) * 60 * 1000).toISOString();
        const recent = await sql`SELECT id FROM alert_events WHERE rule_id = ${rule.id} AND triggered_at > ${cutoff} LIMIT 1`;
        if (recent.length > 0) continue;

        const message = `Alert: ${rule.type} for ${rule.protocol} — value ${currentValue.toFixed(2)} crossed threshold ${threshold}`;
        await sql`INSERT INTO alert_events (rule_id, protocol, network, current_value, message, severity) VALUES (${rule.id}, ${rule.protocol}, ${rule.network}, ${currentValue}, ${message}, ${rule.severity})`;
        await sql`UPDATE alert_rules SET last_triggered = NOW() WHERE id = ${rule.id}`;

        if (rule.webhook_url) {
          const webhookCheck = validateWebhookUrlSync(rule.webhook_url);
          if (webhookCheck.ok) {
            await fetch(rule.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "alert_triggered", ruleId: rule.id, message, currentValue, threshold }),
              signal: AbortSignal.timeout(5000),
              redirect: "error",
            }).catch(() => {});
          } else {
            log("warn", "skipped unsafe webhook URL", { source: "alert-evaluator", ruleId: rule.id, error: webhookCheck.error });
          }
        }
      } catch {}
    }
    log("info", "alert evaluator complete", { source: "alert-evaluator", latencyMs: Date.now() - t0 });
  } catch (err) {
    log("error", "alert evaluator failed", { source: "alert-evaluator", error: String(err) });
  }
}

// ─── 5. HTTP SERVER ──────────────────────────────────────────────
function startHttpServer(): void {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${METRICS_PORT}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }
    if (url.pathname === "/metrics") {
      res.writeHead(200, { "Content-Type": register.contentType });
      res.end(await register.metrics());
      return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(METRICS_PORT, () => log("info", `HTTP server on :${METRICS_PORT}`));
}

function scheduleLoop(fn: () => Promise<void>, intervalMs: number, name: string): void {
  const tick = async () => { try { await fn(); } catch {} setTimeout(tick, intervalMs); };
  setTimeout(tick, Math.random() * 2000);
}

async function main(): Promise<void> {
  log("info", "BaseForge worker (Postgres) starting");
  await bootstrapTables();
  startHttpServer();
  await runCacheWarmer();
  scheduleLoop(runCacheWarmer, 30_000, "cache-warmer");
  scheduleLoop(runRiskScorer, 300_000, "risk-scorer");
  scheduleLoop(runWhaleEventPersister, 300_000, "whale-persister");
  scheduleLoop(runAlertEvaluator, 60_000, "alert-evaluator");
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "fatal", msg: String(err) }));
  process.exit(1);
});
