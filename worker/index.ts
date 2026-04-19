// worker/index.ts
// BaseForge standalone Railway worker.
// Runs four perpetual loops:
//   1. Cache Warmer      — 30s  — fetches DefiLlama/CoinGecko → Upstash Redis
//   2. Risk Scorer       — 5min — computes health scores → Redis + Neon
//   3. Alert Evaluator   — 60s  — checks alert rules → webhook + Neon
//   4. HTTP server       — always — /metrics (Prometheus), /health, POST /events/whale

import http from "node:http";
import { Redis } from "@upstash/redis";
import * as promClient from "prom-client";
import { neon } from "@neondatabase/serverless";

// ─── Environment ─────────────────────────────────────────────────
const UPSTASH_REDIS_URL   = process.env.UPSTASH_REDIS_URL   ?? "";
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN ?? "";
const DATABASE_URL        = process.env.DATABASE_URL         ?? "";
const METRICS_PORT        = Number(process.env.METRICS_PORT ?? 3001);

// Validate required env at startup
if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
  console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg: "Missing UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN", source: "boot" }));
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg: "Missing DATABASE_URL", source: "boot" }));
  process.exit(1);
}

// ─── Redis client ────────────────────────────────────────────────
const redis = new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN });

// ─── Neon SQL client ─────────────────────────────────────────────
// Append PgBouncer params to prevent connection exhaustion in long-running process.
function buildDbUrl(url: string): string {
  if (url.includes("pgbouncer=true")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true&connection_limit=1`;
}
const sql = neon(buildDbUrl(DATABASE_URL));

// ─── Prometheus metrics ──────────────────────────────────────────
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const mUptime = new promClient.Gauge({
  name: "baseforge_uptime_seconds",
  help: "Process uptime in seconds",
  registers: [register],
});

const mCacheSize = new promClient.Gauge({
  name: "baseforge_cache_size",
  help: "Count of Redis keys matching baseforge:*",
  registers: [register],
});

const mCacheHits = new promClient.Counter({
  name: "baseforge_cache_hits_total",
  help: "Total cache hits",
  registers: [register],
});

const mCacheMisses = new promClient.Counter({
  name: "baseforge_cache_misses_total",
  help: "Total cache misses",
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

// ─── CoinGecko token IDs for Base ecosystem ───────────────────────
const BASE_TOKEN_IDS = [
  "ethereum",
  "aerodrome-finance",
  "moonwell-artemis",
  "seamless-protocol",
  "uniswap",
  "aave",
  "compound-governance-token",
  "morpho",
  "pendle",
].join(",");

// ─── Health score logic (mirrors src/lib/protocol-aggregator.ts) ──
interface ProtoForScore {
  name: string;
  audits: number;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  category: string;
  oracles: string[];
  forkedFrom?: string[];
  apy?: number;
}

function calculateHealthScore(proto: ProtoForScore): { score: number; riskFactors: string[] } {
  let score = 50;
  const riskFactors: string[] = [];

  score += proto.audits * 5;
  if (proto.audits < 1) { riskFactors.push("No audits"); score -= 15; }

  const CATEGORY_BASELINE: Record<string, number> = {
    Lending: 15, Dexes: 15, "Liquid Staking": 20, CDP: 15,
    Yield: 5, Bridge: 0, Derivatives: 10, Options: 8,
  };
  score += CATEGORY_BASELINE[proto.category] ?? 5;

  if (proto.tvl > 100_000_000) score += 15;
  else if (proto.tvl > 10_000_000) score += 10;
  else if (proto.tvl > 1_000_000) score += 5;
  else { riskFactors.push("Low TVL"); score -= 10; }

  if (Math.abs(proto.tvlChange7d) > 25) { riskFactors.push("High TVL volatility"); score -= 15; }
  else if (proto.tvlChange7d < -10) { riskFactors.push("TVL declining"); score -= 8; }
  if (Math.abs(proto.tvlChange24h) > 10) { riskFactors.push("Extreme 24h TVL swing"); score -= 10; }
  if (proto.oracles.length < 2) { riskFactors.push("Limited oracle diversity"); score -= 5; }
  if (proto.forkedFrom?.length) score += 3;
  if ((proto.apy ?? 0) > 1000) { riskFactors.push("Suspiciously high APY"); score -= 10; }

  return { score: Math.max(0, Math.min(100, score)), riskFactors };
}

// ─── Base TVL helper ───────────────────────────────────────────────
function getBaseTvl(p: { chainTvls?: Record<string, number> }): number {
  return p.chainTvls?.["Base"] ?? p.chainTvls?.["base"] ?? p.chainTvls?.["BASE"] ?? 0;
}

// ─── DB bootstrap ────────────────────────────────────────────────
// These tables are NOT in the Drizzle schema — we create them with raw SQL.
async function bootstrapTables(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS risk_snapshots (
        id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        protocol    TEXT NOT NULL,
        score       INTEGER NOT NULL,
        health      INTEGER NOT NULL,
        risk_factors JSONB NOT NULL DEFAULT '[]',
        timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS risk_snapshots_protocol_idx ON risk_snapshots (protocol)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS risk_snapshots_timestamp_idx ON risk_snapshots (timestamp)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS whale_events (
        id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tx_hash      TEXT NOT NULL,
        block_number BIGINT,
        amount_usd   NUMERIC(20, 2),
        protocol     TEXT,
        sender       TEXT,
        receiver     TEXT,
        token        TEXT,
        event_type   TEXT NOT NULL DEFAULT 'transfer',
        raw          JSONB,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS whale_events_tx_hash_idx ON whale_events (tx_hash)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS whale_events_created_idx ON whale_events (created_at)
    `;
    log("info", "DB tables bootstrapped", { source: "boot" });
  } catch (err) {
    log("error", "DB bootstrap failed", { source: "boot", error: String(err) });
    // Non-fatal — worker continues; writes will fail gracefully
  }
}

// ─── State ────────────────────────────────────────────────────────
let lastTick = 0;

// ─── 1. CACHE WARMER ─────────────────────────────────────────────
async function runCacheWarmer(): Promise<void> {
  const t0 = Date.now();
  const updatedKeys: string[] = [];

  // --- DefiLlama protocols ---
  try {
    const res = await timedFetch("https://api.llama.fi/protocols", "defillama-protocols");
    if (res.ok) {
      const raw: unknown[] = await res.json();
      const EXCLUDED = new Set(["CEX", "Chain"]);
      const base20 = (raw as Array<{ chains?: string[]; category?: string; chainTvls?: Record<string, number>; change_1d?: number; change_7d?: number; name: string; slug?: string; logo?: string }>)
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
          chainTvls: p.chainTvls,
        }));
      await redis.set("baseforge:protocols", JSON.stringify(base20), { ex: 60 });
      updatedKeys.push("protocols");
    }
  } catch {
    // already logged in timedFetch
  }

  // --- DefiLlama TVL history ---
  try {
    const res = await timedFetch("https://api.llama.fi/v2/historicalChainTvl/Base", "defillama-tvl");
    if (res.ok) {
      const raw = await res.json();
      await redis.set("baseforge:tvl_history", JSON.stringify(raw), { ex: 300 });
      updatedKeys.push("tvl_history");
    }
  } catch { /* logged */ }

  // --- DefiLlama fees ---
  try {
    const res = await timedFetch("https://api.llama.fi/overview/fees?chain=base", "defillama-fees");
    if (res.ok) {
      const raw = await res.json();
      await redis.set("baseforge:fees", JSON.stringify(raw), { ex: 120 });
      updatedKeys.push("fees");
    }
  } catch { /* logged */ }

  // --- CoinGecko prices ---
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${BASE_TOKEN_IDS}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const res = await timedFetch(url, "coingecko-prices");
    if (res.ok) {
      const raw = await res.json();
      await redis.set("baseforge:prices", JSON.stringify(raw), { ex: 30 });
      updatedKeys.push("prices");
    }
  } catch { /* logged */ }

  // Publish update event so subscribers know fresh data is available
  if (updatedKeys.length > 0) {
    try {
      await redis.publish("baseforge:update", JSON.stringify({ ts: Date.now(), keys: updatedKeys }));
    } catch (err) {
      log("warn", "Redis publish failed", { source: "cache-warmer", error: String(err) });
    }
  }

  // Update metrics cache size (scan for baseforge:* keys)
  try {
    const keys = await redis.keys("baseforge:*");
    mCacheSize.set(keys.length);
  } catch { /* non-critical */ }

  mTicks.inc();
  mUptime.set(process.uptime());
  lastTick = Date.now();

  log("info", "cache warmer tick complete", {
    source: "cache-warmer",
    latencyMs: Date.now() - t0,
    keys: updatedKeys,
  });
}

// ─── 2. RISK SCORER ──────────────────────────────────────────────
async function runRiskScorer(): Promise<void> {
  const t0 = Date.now();
  try {
    // Read protocols from the warmed cache
    const raw = await redis.get<string>("baseforge:protocols");
    if (!raw) {
      log("warn", "risk scorer: no cached protocols found", { source: "risk-scorer" });
      return;
    }

    const protocols: Array<{
      id: string; name: string; category: string; tvl: number;
      tvlChange24h: number; tvlChange7d: number;
    }> = typeof raw === "string" ? JSON.parse(raw) : raw;

    const scores = protocols.map((p) => {
      const { score, riskFactors } = calculateHealthScore({
        name: p.name,
        audits: 0, // not cached in warmer — scoring still useful for TVL/volatility signals
        tvl: p.tvl,
        tvlChange24h: p.tvlChange24h,
        tvlChange7d: p.tvlChange7d,
        category: p.category,
        oracles: [],
      });
      return { protocol: p.id, name: p.name, score, health: score, riskFactors };
    });

    // Store aggregate in Redis
    await redis.set("risk:scores", JSON.stringify(scores), { ex: 300 });

    // Persist each snapshot to Neon
    for (const s of scores) {
      try {
        await sql`
          INSERT INTO risk_snapshots (protocol, score, health, risk_factors, timestamp)
          VALUES (${s.protocol}, ${s.score}, ${s.health}, ${JSON.stringify(s.riskFactors)}, NOW())
        `;
      } catch (err) {
        log("warn", "risk snapshot insert failed", { source: "risk-scorer", protocol: s.protocol, error: String(err) });
      }
    }

    log("info", "risk scorer complete", {
      source: "risk-scorer",
      latencyMs: Date.now() - t0,
      count: scores.length,
    });
  } catch (err) {
    log("error", "risk scorer failed", { source: "risk-scorer", error: String(err) });
  }
}

// ─── 3. ALERT EVALUATOR ──────────────────────────────────────────
async function runAlertEvaluator(): Promise<void> {
  const t0 = Date.now();
  try {
    // Fetch active alert rules from Neon
    const rules = await sql`
      SELECT id, type, protocol, condition, threshold, severity, cooldown_minutes,
             network
      FROM alert_rules
      WHERE enabled = true
    ` as Array<{
      id: string;
      type: string;
      protocol: string;
      condition: string;
      threshold: string;
      severity: string;
      cooldown_minutes: number;
      network: string | null;
    }>;

    if (!rules.length) return;

    // Load cached protocols for current metric values
    const rawProtos = await redis.get<string>("baseforge:protocols");
    if (!rawProtos) return;

    const protocols: Array<{ id: string; tvl: number; tvlChange24h: number; tvlChange7d: number }> =
      typeof rawProtos === "string" ? JSON.parse(rawProtos) : rawProtos;

    const protoMap = new Map(protocols.map((p) => [p.id, p]));

    for (const rule of rules) {
      try {
        const proto = protoMap.get(rule.protocol);
        if (!proto) continue;

        const threshold = parseFloat(rule.threshold);
        let currentValue: number | null = null;
        let triggered = false;

        switch (rule.type) {
          case "tvl_drop":
            currentValue = proto.tvlChange24h;
            triggered = rule.condition === "below" ? currentValue < -threshold : currentValue > threshold;
            break;
          case "utilization_spike":
            // utilization not in cached protocols — skip for now
            break;
          case "health_decrease": {
            const riskRaw = await redis.get<string>("risk:scores");
            if (riskRaw) {
              const scores: Array<{ protocol: string; score: number }> =
                typeof riskRaw === "string" ? JSON.parse(riskRaw) : riskRaw;
              const entry = scores.find((s) => s.protocol === rule.protocol);
              if (entry) {
                currentValue = entry.score;
                triggered = currentValue < threshold;
              }
            }
            break;
          }
          default:
            break;
        }

        if (!triggered || currentValue === null) continue;

        // Check cooldown: has an alert event been inserted for this rule recently?
        const cooldownMs = (rule.cooldown_minutes ?? 60) * 60 * 1000;
        const cutoff = new Date(Date.now() - cooldownMs).toISOString();
        const recent = await sql`
          SELECT id FROM alert_events
          WHERE rule_id = ${rule.id}
            AND triggered_at > ${cutoff}
          LIMIT 1
        `;
        if (recent.length > 0) continue; // Still in cooldown

        // Record the event
        const message = `Alert: ${rule.type} for ${rule.protocol} — value ${currentValue.toFixed(2)} crossed threshold ${threshold}`;
        await sql`
          INSERT INTO alert_events (rule_id, protocol, network, current_value, message, severity)
          VALUES (
            ${rule.id},
            ${rule.protocol},
            ${rule.network ?? null},
            ${currentValue},
            ${message},
            ${rule.severity}
          )
        `;

        log("warn", "alert triggered", {
          source: "alert-evaluator",
          ruleId: rule.id,
          type: rule.type,
          protocol: rule.protocol,
          currentValue,
          threshold,
          severity: rule.severity,
        });
      } catch (err) {
        log("error", "alert rule evaluation failed", { source: "alert-evaluator", ruleId: rule.id, error: String(err) });
      }
    }

    log("info", "alert evaluator complete", { source: "alert-evaluator", latencyMs: Date.now() - t0, rules: rules.length });
  } catch (err) {
    log("error", "alert evaluator failed", { source: "alert-evaluator", error: String(err) });
  }
}

// ─── 4. HTTP SERVER ──────────────────────────────────────────────
// Endpoints:
//   GET  /health          → { status, uptime, lastTick }
//   GET  /metrics         → Prometheus text format
//   POST /events/whale    → insert whale event into Neon

interface WhaleEventPayload {
  txHash: string;
  blockNumber?: number;
  amountUsd?: number;
  protocol?: string;
  sender?: string;
  receiver?: string;
  token?: string;
  eventType?: string;
  raw?: unknown;
}

function startHttpServer(): void {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${METRICS_PORT}`);

    // ── GET /health ──
    if (req.method === "GET" && url.pathname === "/health") {
      const body = JSON.stringify({ status: "ok", uptime: process.uptime(), lastTick });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }

    // ── GET /metrics ──
    if (req.method === "GET" && url.pathname === "/metrics") {
      try {
        mUptime.set(process.uptime());
        const metrics = await register.metrics();
        res.writeHead(200, { "Content-Type": register.contentType });
        res.end(metrics);
      } catch (err) {
        res.writeHead(500);
        res.end("metrics error");
        log("error", "metrics endpoint error", { source: "http", error: String(err) });
      }
      return;
    }

    // ── POST /events/whale ──
    if (req.method === "POST" && url.pathname === "/events/whale") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body) as WhaleEventPayload;
          if (!payload.txHash) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "txHash is required" }));
            return;
          }
          await sql`
            INSERT INTO whale_events (tx_hash, block_number, amount_usd, protocol, sender, receiver, token, event_type, raw)
            VALUES (
              ${payload.txHash},
              ${payload.blockNumber ?? null},
              ${payload.amountUsd ?? null},
              ${payload.protocol ?? null},
              ${payload.sender ?? null},
              ${payload.receiver ?? null},
              ${payload.token ?? null},
              ${payload.eventType ?? "transfer"},
              ${payload.raw ? JSON.stringify(payload.raw) : null}
            )
            ON CONFLICT (tx_hash) DO NOTHING
          `;
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          log("info", "whale event inserted", { source: "http", txHash: payload.txHash });
        } catch (err) {
          const isConflict = String(err).includes("duplicate") || String(err).includes("unique");
          if (isConflict) {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "duplicate txHash" }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "insert failed" }));
            log("error", "whale event insert error", { source: "http", error: String(err) });
          }
        }
      });
      return;
    }

    // ── Cache hit/miss tracking proxy ──
    // The Next.js app can increment hit/miss counters via:
    //   POST /metrics/cache/hit  or  POST /metrics/cache/miss
    if (req.method === "POST" && url.pathname === "/metrics/cache/hit") {
      mCacheHits.inc();
      res.writeHead(204); res.end(); return;
    }
    if (req.method === "POST" && url.pathname === "/metrics/cache/miss") {
      mCacheMisses.inc();
      res.writeHead(204); res.end(); return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(METRICS_PORT, () => {
    log("info", `HTTP server listening on :${METRICS_PORT}`, { source: "http" });
  });

  server.on("error", (err) => {
    log("error", "HTTP server error", { source: "http", error: String(err) });
  });
}

// ─── Scheduler ───────────────────────────────────────────────────
function scheduleLoop(fn: () => Promise<void>, intervalMs: number, name: string): void {
  const tick = async () => {
    try {
      await fn();
    } catch (err) {
      // Top-level safety net — individual tasks already handle their errors
      log("error", `unexpected error in ${name}`, { source: name, error: String(err) });
    }
    setTimeout(tick, intervalMs);
  };
  // Stagger initial runs slightly to avoid thundering herd on boot
  const jitter = Math.random() * 2000;
  setTimeout(tick, jitter);
  log("info", `scheduled ${name} every ${intervalMs / 1000}s`, { source: "scheduler" });
}

// ─── Boot ─────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log("info", "BaseForge worker starting", { source: "boot" });

  await bootstrapTables();

  startHttpServer();

  // Run cache warmer immediately, then every 30s
  await runCacheWarmer();
  scheduleLoop(runCacheWarmer, 30_000, "cache-warmer");

  // Risk scorer every 5 minutes
  scheduleLoop(runRiskScorer, 5 * 60_000, "risk-scorer");

  // Alert evaluator every 60s
  scheduleLoop(runAlertEvaluator, 60_000, "alert-evaluator");

  log("info", "BaseForge worker ready", { source: "boot" });
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "fatal", ts: new Date().toISOString(), msg: String(err), source: "boot" }));
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log("info", "SIGTERM received — shutting down", { source: "boot" });
  process.exit(0);
});
process.on("SIGINT", () => {
  log("info", "SIGINT received — shutting down", { source: "boot" });
  process.exit(0);
});
