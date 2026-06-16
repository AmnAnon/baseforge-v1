// src/app/api/alerts/route.ts
// Alert check engine — evaluates rules against live data, returns recent events.

import { NextResponse } from "next/server";
import { gte, desc } from "drizzle-orm";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { AlertsResponseSchema } from "@/lib/zod/schemas";
import { evaluateAlertRules } from "@/lib/alert-engine";
import type { AlertEvent } from "@/lib/db/schema";

const EMPTY_ALERTS = () => ({
  alerts: [],
  timestamp: Date.now(),
  isStale: true,
});

function serializeAlertEvent(row: AlertEvent) {
  return {
    id: row.id,
    ruleId: row.ruleId,
    protocol: row.protocol,
    network: row.network,
    currentValue: String(row.currentValue),
    message: row.message,
    severity: row.severity,
    triggeredAt:
      row.triggeredAt instanceof Date
        ? row.triggeredAt.toISOString()
        : String(row.triggeredAt),
    acknowledged: row.acknowledged,
    acknowledgedAt: row.acknowledgedAt
      ? row.acknowledgedAt instanceof Date
        ? row.acknowledgedAt.toISOString()
        : String(row.acknowledgedAt)
      : null,
  };
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(EMPTY_ALERTS(), {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  }

  try {
    await evaluateAlertRules();

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { db } = await import("@/lib/db/client");
    const { alertEvents } = await import("@/lib/db/schema");

    const triggered = await db
      .select()
      .from(alertEvents)
      .where(gte(alertEvents.triggeredAt, twentyFourHoursAgo))
      .orderBy(desc(alertEvents.triggeredAt));

    const validated = validateOrFallback(
      AlertsResponseSchema,
      {
        alerts: triggered.map(serializeAlertEvent),
        timestamp: Date.now(),
        isStale: false,
      },
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