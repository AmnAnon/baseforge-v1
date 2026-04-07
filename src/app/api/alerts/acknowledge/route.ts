// src/app/api/alerts/acknowledge/route.ts
// Acknowledge a triggered alert event to clear it from the dashboard.
// POST — mark a single event as acknowledged
// DELETE — clear all acknowledged events older than 24h (cleanup)

import { NextResponse } from "next/server";
import { eq, and, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertEvents } from "@/lib/db/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const [updated] = await db
      .update(alertEvents)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
      })
      .where(eq(alertEvents.id, eventId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event: updated }, { status: 200 });
  } catch (err) {
    console.error("[alerts/acknowledge] POST error:", err);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(alertEvents)
      .where(
        and(
          eq(alertEvents.acknowledged, true),
          lte(alertEvents.triggeredAt, weekAgo)
        )
      );

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    console.error("[alerts/acknowledge] DELETE error:", err);
    return NextResponse.json({ error: "Failed to clean up alerts" }, { status: 500 });
  }
}
