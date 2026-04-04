// src/lib/logger.ts
// Structured logger with levels, timestamps, and context support.
// Uses pino in production, console fallback in dev.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  ts: string;
  msg: string;
  ctx?: Record<string, unknown>;
}

// Simple async write target — swap for pino/Winston later when configured
const LOG_LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

let LOG_LEVEL = (process.env.LOG_LEVEL || "info") as LogLevel;

function log(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[LOG_LEVEL]) return;

  const entry: LogEntry = {
    level,
    ts: new Date().toISOString(),
    msg,
    ...(ctx && Object.keys(ctx).length > 0 ? { ctx } : {}),
  };

  if (process.env.NODE_ENV === "production") {
    // JSON structured log for stdout → log aggregator (Datadog, Vercel)
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[method](JSON.stringify(entry));
  } else {
    const color = {
      debug: "\x1b[36m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
    }[level];
    const reset = "\x1b[0m";
    const ctxStr = ctx && Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : "";
    console.debug(`\n${color}[${level.toUpperCase()}]${reset} ${entry.ts} ${msg}${ctxStr}`);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  setLevel: (level: LogLevel) => { LOG_LEVEL = level; },
};

// Helper: track API latency
export function timing(label: string): () => number {
  const start = performance.now();
  return () => {
    const ms = performance.now() - start;
    logger.debug(`${label} completed`, { latencyMs: Math.round(ms) });
    return ms;
  };
}
