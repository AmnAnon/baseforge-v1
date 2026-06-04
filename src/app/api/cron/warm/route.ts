// src/app/api/cron/warm/route.ts
// Vercel Cron — warms Postgres cache when WORKER_URL is not deployed.
// Auth: Authorization: Bearer <CRON_SECRET> (set in Vercel env + vercel.json).

import { NextResponse } from "next/server";
import { warmSharedCache } from "@/lib/cache-warmer";
import { resolveCacheBackend } from "@/lib/env-config";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL required for cache warming" },
      { status: 503 },
    );
  }

  if (resolveCacheBackend() !== "postgres") {
    logger.warn("cron/warm: cache backend is not postgres");
  }

  try {
    const result = await warmSharedCache();
    return NextResponse.json(
      {
        status: result.ok ? "ok" : "partial",
        ...result,
        backend: resolveCacheBackend(),
      },
      { status: result.ok ? 200 : 207 },
    );
  } catch (e: unknown) {
    logger.error("cron/warm failed", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { status: "error", error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}