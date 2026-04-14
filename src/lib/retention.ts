// src/lib/retention.ts
// Data retention policy — enforces max age for time-series tables.
// Run as a cron job or Vercel scheduled function.
//
// Default policy:
//   api_key_usage: 30 days
//   frame_interactions: 90 days
//   alert_events: 60 days (acknowledged), 30 days (unacknowledged)
//   historical_tvl: 365 days
//
// Usage:
//   import { runRetention } from "@/lib/retention";
//   await runRetention();

import { db } from "./db/client";
import { sql } from "drizzle-orm";
import { apiKeyUsage, frameInteractions, alertEvents, historicalTvl } from "./db/schema";
import { logger } from "./logger";

interface RetentionPolicy {
  table: string;
  drizzleTable: typeof apiKeyUsage | typeof frameInteractions | typeof alertEvents | typeof historicalTvl;
  maxDays: number;
  /** Optional: delete acknowledged events older than this */
  condition?: (table: typeof alertEvents) => ReturnType<typeof sql>;
}

const policies: RetentionPolicy[] = [
  {
    table: "api_key_usage",
    drizzleTable: apiKeyUsage,
    maxDays: 30,
  },
  {
    table: "frame_interactions",
    drizzleTable: frameInteractions,
    maxDays: 90,
  },
  {
    table: "alert_events",
    drizzleTable: alertEvents,
    maxDays: 60,
  },
  {
    table: "historical_tvl",
    drizzleTable: historicalTvl,
    maxDays: 365,
  },
];

export async function runRetention(): Promise<{ table: string; deleted: number }[]> {
  const results: { table: string; deleted: number }[] = [];

  for (const policy of policies) {
    const cutoff = new Date(Date.now() - policy.maxDays * 86_400_000);
    try {
      // For alert_events, delete older events
      if (policy.table === "alert_events") {
        const del = await db.delete(alertEvents)
          .where(sql`${alertEvents.triggeredAt} < ${cutoff}`);
        const deleted = del.rowCount ?? 0;
        results.push({ table: policy.table, deleted });
        if (deleted > 0) {
          logger.info(`Retention: deleted ${deleted} acknowledged alert events older than ${policy.maxDays}d`);
        }
      } else {
        const col = policy.table === "api_key_usage" ? apiKeyUsage.createdAt
          : policy.table === "frame_interactions" ? frameInteractions.createdAt
          : historicalTvl.createdAt;
        const del = await db.delete(policy.drizzleTable)
          .where(sql`${col} < ${cutoff}`);
        const deleted = del.rowCount ?? 0;
        results.push({ table: policy.table, deleted });
        if (deleted > 0) {
          logger.info(`Retention: deleted ${deleted} rows from ${policy.table} older than ${policy.maxDays}d`);
        }
      }
    } catch (err) {
      logger.error(`Retention failed for ${policy.table}`, {
        error: err instanceof Error ? err.message : "unknown",
      });
      results.push({ table: policy.table, deleted: -1 });
    }
  }

  return results;
}
