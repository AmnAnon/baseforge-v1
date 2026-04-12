// src/lib/monitoring.ts
// Observability layer — Sentry alerts for data source failures,
// performance tracking, and structured error reporting.
//
// Usage:
//   monitor.trackDataSourceFailure("envio", error, { route: "/api/whales" })
//   monitor.trackLatency("defillama.protocols", 230)
//   monitor.reportAnomaly("high_risk_protocol", { protocol: "xyz", risk: 85 })

import { logger } from "./logger";

// Lazy Sentry import — only loaded when DSN is configured
async function getSentry() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return null;
  try {
    return await import("@sentry/nextjs");
  } catch {
    return null;
  }
}

export const monitor = {
  /**
   * Track a data source failure. Creates a Sentry error with structured context
   * so you can set up alerts on specific data source outages.
   */
  async trackDataSourceFailure(
    source: "envio" | "etherscan" | "defillama" | "coingecko" | "neon" | "upstash",
    error: unknown,
    context?: Record<string, unknown>
  ) {
    const msg = error instanceof Error ? error.message : String(error);

    logger.error(`Data source failure: ${source}`, {
      source,
      error: msg,
      ...context,
    });

    const Sentry = await getSentry();
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setTag("data_source", source);
        scope.setTag("error_type", "data_source_failure");
        scope.setLevel("error");
        scope.setContext("data_source", {
          source,
          errorMessage: msg,
          ...context,
        });
        // Fingerprint by source so Sentry groups these together
        scope.setFingerprint(["data-source-failure", source]);

        if (error instanceof Error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(`Data source failure: ${source} — ${msg}`, "error");
        }
      });
    }
  },

  /**
   * Track a data source recovery after a failure period.
   */
  async trackDataSourceRecovery(
    source: string,
    downtimeMs: number
  ) {
    logger.info(`Data source recovered: ${source}`, {
      source,
      downtimeMs,
    });

    const Sentry = await getSentry();
    if (Sentry) {
      Sentry.captureMessage(`Data source recovered: ${source} (down ${Math.round(downtimeMs / 1000)}s)`, "info");
    }
  },

  /**
   * Track API route latency for performance monitoring.
   * Sentry receives these as custom measurements on transactions.
   */
  async trackLatency(
    operation: string,
    latencyMs: number,
    context?: Record<string, unknown>
  ) {
    logger.debug(`Latency: ${operation}`, { latencyMs, ...context });

    // Flag slow operations (> 5s)
    if (latencyMs > 5000) {
      logger.warn(`Slow operation: ${operation}`, { latencyMs, ...context });

      const Sentry = await getSentry();
      if (Sentry) {
        Sentry.withScope((scope) => {
          scope.setTag("operation", operation);
          scope.setTag("error_type", "slow_operation");
          scope.setLevel("warning");
          scope.setContext("performance", { operation, latencyMs, ...context });
          scope.setFingerprint(["slow-operation", operation]);
          Sentry.captureMessage(`Slow operation: ${operation} (${latencyMs}ms)`, "warning");
        });
      }
    }
  },

  /**
   * Report an anomaly detected by the risk engine (for Sentry alerting).
   */
  async reportAnomaly(
    type: string,
    details: Record<string, unknown>
  ) {
    logger.warn(`Anomaly detected: ${type}`, details);

    const Sentry = await getSentry();
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setTag("anomaly_type", type);
        scope.setTag("error_type", "anomaly");
        scope.setLevel("warning");
        scope.setContext("anomaly", { type, ...details });
        scope.setFingerprint(["anomaly", type]);
        Sentry.captureMessage(`Anomaly: ${type}`, "warning");
      });
    }
  },

  /**
   * Track indexer provider switch (primary → fallback).
   */
  async trackProviderSwitch(
    from: string,
    to: string,
    reason: string
  ) {
    logger.warn(`Provider switch: ${from} → ${to}`, { reason });

    const Sentry = await getSentry();
    if (Sentry) {
      Sentry.addBreadcrumb({
        category: "indexer",
        message: `Provider switch: ${from} → ${to} (${reason})`,
        level: "warning",
      });
    }
  },
};
