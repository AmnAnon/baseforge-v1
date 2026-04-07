// src/app/api/alerts/rules/[id]/route.ts
// Individual rule operations.
// GET — get a single rule by ID
// PATCH — update an existing rule
// DELETE — delete a rule

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertRules } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [rule] = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, id));

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ rule }, { status: 200 });
  } catch (err) {
    console.error("[alerts/rules/[id]] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch rule" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { enabled, threshold, cooldownMinutes, condition, protocol, severity, type } = body;

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof enabled === "boolean") setValues.enabled = enabled;
    if (typeof threshold === "number") setValues.threshold = String(threshold);
    if (typeof cooldownMinutes === "number") setValues.cooldownMinutes = cooldownMinutes;
    if (typeof condition === "string") setValues.condition = condition;
    if (typeof protocol === "string") setValues.protocol = protocol;
    if (typeof type === "string") setValues.type = type;
    if (typeof severity === "string") setValues.severity = severity as "critical" | "warning" | "info";

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
    console.error("[alerts/rules/[id]] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [deleted] = await db
      .delete(alertRules)
      .where(eq(alertRules.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Rule deleted" }, { status: 200 });
  } catch (err) {
    console.error("[alerts/rules/[id]] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
