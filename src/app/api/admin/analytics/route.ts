// src/app/api/admin/analytics/route.ts
// Aggregated frame interaction analytics for the admin dashboard.
// Protected by x-admin-key header (timing-safe compare + rate limiting via adminAuthMiddleware).

import { NextResponse } from "next/server";
import { count, sql, desc } from "drizzle-orm";
import { frameInteractions as t } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { adminAuthMiddleware } from "@/lib/admin-auth";

const BUTTON_LABELS: Record<number, string> = {
  1: "Launch Dashboard (Overview)",
  2: "Whales",
  3: "Risk",
};

// ─── Queries ────────────────────────────────────────────────────────

async function getTotalInteractions() {
  const [row] = await db.select({ total: count() }).from(t);
  return Number(row?.total ?? 0);
}

async function getClicksPerButton() {
  const rows = await db
    .select({
      buttonIndex: t.buttonIndex,
      clicks: count(),
    })
    .from(t)
    .groupBy(t.buttonIndex)
    .orderBy(t.buttonIndex);

  return rows.map((r) => ({
    buttonIndex: r.buttonIndex,
    label: BUTTON_LABELS[r.buttonIndex] || `Button ${r.buttonIndex}`,
    clicks: Number(r.clicks),
  }));
}

async function getUniqueFIDs() {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${t.fid})` })
    .from(t)
    .where(sql`${t.fid} IS NOT NULL`);
  return Number(row?.n ?? 0);
}

/** Daily Active Users — distinct FIDs per day over the last 7 days */
async function getDAUTrend() {
  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${t.createdAt})::date::text`,
      dau: sql<number>`count(distinct ${t.fid})`,
      interactions: count(),
    })
    .from(t)
    .where(sql`${t.createdAt} >= now() - interval '7 days'`)
    .groupBy(sql`date_trunc('day', ${t.createdAt})`)
    .orderBy(sql`date_trunc('day', ${t.createdAt})`);

  return rows.map((r) => ({
    date: r.date,
    dau: Number(r.dau),
    interactions: Number(r.interactions),
  }));
}

async function getClicksPerTab() {
  const rows = await db
    .select({ tab: t.tab, clicks: count() })
    .from(t)
    .groupBy(t.tab)
    .orderBy(desc(count()));

  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.tab) result[row.tab] = Number(row.clicks);
  }
  return result;
}

async function getTopProtocols(limit = 10) {
  const rows = await db
    .select({ protocol: t.protocol, views: count() })
    .from(t)
    .where(sql`${t.protocol} IS NOT NULL`)
    .groupBy(t.protocol)
    .orderBy(desc(count()))
    .limit(limit);

  return rows
    .filter((r) => r.protocol)
    .map((r) => ({ protocol: r.protocol!, views: Number(r.views) }));
}

// ─── Route ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const denied = await adminAuthMiddleware(request);
  if (denied) return denied;

  try {
    const [
      totalInteractions,
      clicksPerButton,
      uniqueUsers,
      dauTrend,
      clicksPerTab,
      topProtocols,
    ] = await Promise.all([
      getTotalInteractions(),
      getClicksPerButton(),
      getUniqueFIDs(),
      getDAUTrend(),
      getClicksPerTab(),
      getTopProtocols(),
    ]);

    return NextResponse.json({
      totalInteractions,
      uniqueUsers,
      clicksPerButton,
      dauTrend,
      clicksPerTab,
      topProtocols,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}