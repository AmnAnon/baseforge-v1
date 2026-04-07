// src/app/api/alerts/rules/route.ts
// CRUD operations for alert rules.
// GET — list all rules (enabled + disabled)
// POST — create a new alert rule
// PATCH — toggle or update an existing rule

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertRules } from "@/lib/db/schema";

const ALERT_TYPES = ["tvl_drop", "utilization_spike", "apy_anomaly", "whale_movement", "health_decrease"] as const;
const SEVERITIES = ["critical", "warning", "info"] as const;

export async function GET() {
  try {
    const rules = await db
      .select()
      .from(alertRules)
      .orderBy(alertRules.createdAt);

    return NextResponse.json({ rules }, { status: 200 });
  } catch (err) {
    console.error("[alerts/rules] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch alert rules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, protocol, network, condition, threshold, severity, cooldownMinutes, enabled } = body;

    if (!ALERT_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid alert type: ${type}` }, { status: 400 });
    }

    if (!SEVERITIES.includes(severity)) {
      return NextResponse.json({ error: `Invalid severity: ${severity}` }, { status: 400 });
    }

    if (!condition || typeof threshold !== "number" || !protocol) {
      return NextResponse.json(
        { error: "condition, threshold, and protocol are required" },
        { status: 400 }
      );
    }

    const [rule] = await db
      .insert(alertRules)
      .values({
        type,
        protocol,
        network: network ?? null,
        condition,
        threshold: String(threshold),
        severity,
        cooldownMinutes: cooldownMinutes ?? 60,
        enabled: enabled ?? true,
      })
      .returning();

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error("[alerts/rules] POST error:", err);
    return NextResponse.json({ error: "Failed to create alert rule" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, enabled, threshold, cooldownMinutes } = body;

    if (!id) {
      return NextResponse.json({ error: "rule id is required" }, { status: 400 });
    }

    const setValues: Record<string, string | number | boolean> = {};
    if (typeof enabled === "boolean") setValues.enabled = enabled;
    if (typeof threshold === "number") setValues.threshold = String(threshold);
    if (typeof cooldownMinutes === "number") setValues.cooldownMinutes = cooldownMinutes;
    setValues.updatedAt = new Date().toISOString();

    const [updated] = await db
      .update(alertRules)
      .set(setValues)
      .where(eq(alertRules.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ rule: updated }, { status: 200 });
  } catch (err) {
    console.error("[alerts/rules] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update alert rule" }, { status: 500 });
  }
}
