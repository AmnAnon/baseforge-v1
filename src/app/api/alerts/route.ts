// src/app/api/alerts/route.ts
// Alert check engine — scans Base protocols against persisted alert rules in Postgres.
// Reads rules from the database, evaluates conditions against live DefiLlama data,
// and records triggered events with cooldown enforcement.

import { NextResponse } from "next/server";
import { and, eq, gte, desc, count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertRules, alertEvents } from "@/lib/db/schema";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { AlertsResponseSchema } from "@/lib/zod/schemas";

const EMPTY_ALERTS = () => ({
  alerts: [],
  timestamp: Date.now(),
  isStale: true,
});

async function evaluateAlertRules() {
  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true));

  let protocols: {
    name: string;
    slug: string;
    tvl?: number;
    change_1d?: number;
    change_7d?: number;
    audits?: number;
    apyMean30d?: number;
    chainTvls?: Record<string, number>;
  }[] = [];
  try {
    const protocolsRes = await fetch("https://api.llama.fi/protocols", { cache: "no-store" });
    if (protocolsRes.ok) {
      protocols = await protocolsRes.json();
    }
  } catch {
    return;
  }

  const baseProtos = protocols.filter(
    (p) => (p.chainTvls?.Base || 0) > 1_000_000
  );

  const now = new Date();

  for (const proto of baseProtos) {
    const name = proto.name;

    for (const rule of rules) {
      if (rule.protocol !== "*" && rule.protocol !== proto.slug && rule.protocol !== name) continue;

      let value = 0;
      let triggered = false;

      switch (rule.condition) {
        case "tvl_change_24h_pct": {
          value = proto.change_1d || 0;
          triggered = value < Number(rule.threshold);
          break;
        }
        case "utilization_pct": {
          value = proto.tvl ? 100 - Math.abs(proto.change_7d || 0) : 0;
          triggered = value > Number(rule.threshold);
          break;
        }
        case "health_score": {
          const audits = proto.audits || 0;
          const change7d = proto.change_7d || 0;
          value = Math.max(0, 50 + audits * 5 + (change7d < -10 ? -10 : 0));
          triggered = value < Number(rule.threshold);
          break;
        }
        case "apy": {
          value = proto.apyMean30d || 0;
          triggered = value > Number(rule.threshold);
          break;
        }
      }

      if (!triggered) continue;

      const cutoff = new Date(now.getTime() - rule.cooldownMinutes! * 60 * 1000);
      const recent = await db
        .select({ count: count() })
        .from(alertEvents)
        .where(
          and(
            eq(alertEvents.ruleId, rule.id),
            eq(alertEvents.protocol, name),
            gte(alertEvents.triggeredAt, cutoff)
          )
        );

      if (recent[0]?.count > 0) continue;

      const message = buildAlertMessage(rule.condition, name, value);

      await db
        .insert(alertEvents)
        .values({
          ruleId: rule.id,
          protocol: name,
          currentValue: String(value),
          message,
          severity: rule.severity,
          network: rule.network ?? "Base",
        });
    }
  }
}

function buildAlertMessage(condition: string, name: string, value: number) {
  switch (condition) {
    case "tvl_change_24h_pct":
      return `${name} TVL dropped ${value.toFixed(1)}% in 24h`;
    case "utilization_pct":
      return `${name} utilization at ${value.toFixed(1)}%`;
    case "health_score":
      return `${name} health score at ${value.toFixed(0)} (unaudited + declining TVL)`;
    case "apy":
      return `${name} 30d mean APY at ${value.toFixed(1)}% — anomalous yield`;
    default:
      return `${name} alert triggered: ${condition} = ${value}`;
  }
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await evaluateAlertRules();

    const triggered = await db
      .select()
      .from(alertEvents)
      .where(gte(alertEvents.triggeredAt, twentyFourHoursAgo))
      .orderBy(desc(alertEvents.triggeredAt));

    const validated = validateOrFallback(
      AlertsResponseSchema,
      { alerts: triggered, timestamp: Date.now() },
      EMPTY_ALERTS(),
      "alerts"
    );

    return NextResponse.json(validated, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[alerts] Error:", err);
    return NextResponse.json({ ...EMPTY_ALERTS(), isStale: true }, { status: 500 });
  }
}
