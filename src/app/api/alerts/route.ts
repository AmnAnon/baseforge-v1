// src/app/api/alerts/route.ts
// Alert check engine — scans Base protocols against persisted alert rules in Postgres.
// Reads rules from the database, evaluates conditions against live DefiLlama data,
// and records triggered events with cooldown enforcement.
//
// Graceful degradation: if DATABASE_URL is not set, returns empty alerts.

import { NextResponse } from "next/server";
import { gte, desc } from "drizzle-orm";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { validateOrFallback } from "@/lib/validation";
import { AlertsResponseSchema } from "@/lib/zod/schemas";

const EMPTY_ALERTS = () => ({
  alerts: [],
  timestamp: Date.now(),
  isStale: true,
});

const DATABASE_ENABLED = !!process.env.DATABASE_URL;

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  if (!DATABASE_ENABLED) {
    return NextResponse.json(EMPTY_ALERTS(), {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  }

  try {
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
