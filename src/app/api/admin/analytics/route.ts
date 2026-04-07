// src/app/api/admin/analytics/route.ts
// Queries frame_interactions for admin dashboard analytics.
// Protects via a simple admin FID check passed as ?adminFid=.

import { NextResponse } from "next/server";
import { eq, count, sql } from "drizzle-orm";
import { frameInteractions as frameTable } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

// Hardcoded admin FID — replace with your actual Farcaster FID
const ADMIN_FID = process.env.ADMIN_FID ? parseInt(process.env.ADMIN_FID) : 666666;

// ─── helpers ───────────────────────────────────────────────────────────

async function getClicksPerTab() {
  const rows = await db
    .select({
      tab: frameTable.tab,
      clicks: count(),
    })
    .from(frameTable)
    .groupBy(frameTable.tab);

  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.tab) {
      result[row.tab] = Number(row.clicks);
    }
  }
  return result;
}

async function getUniqueFIDs() {
  const rows = await db
    .select({ uniqueCount: countDistinct(frameTable.fid) })
    .from(frameTable)
    .where(sql`${frameTable.fid} IS NOT NULL`);

  return Number(rows[0]?.uniqueCount ?? 0);
}

async function getTotalInteractions() {
  const rows = await db.select({ total: count() }).from(frameTable);
  return Number(rows[0]?.total ?? 0);
}

async function getTopProtocols(limit = 10) {
  const rows = await db
    .select({
      protocol: frameTable.protocol,
      views: count(),
    })
    .from(frameTable)
    .where(sql`${frameTable.protocol} IS NOT NULL`)
    .groupBy(frameTable.protocol)
    .orderBy(sql`views DESC`)
    .limit(limit);

  return rows
    .filter(r => r.protocol)
    .map(r => ({ protocol: r.protocol!, views: Number(r.views) }));
}

function countDistinct(expr: typeof frameTable.fid) {
  return sql<number>`count(distinct ${expr})`;
}

// ─── route ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminFid = parseInt(searchParams.get("adminFid") || "0");

  if (!adminFid || adminFid !== ADMIN_FID) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [clicksPerTab, uniqueUsers, totalInteractions, topProtocols] = await Promise.all([
      getClicksPerTab(),
      getUniqueFIDs(),
      getTotalInteractions(),
      getTopProtocols(),
    ]);

    return NextResponse.json({
      totalInteractions,
      uniqueUsers,
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
