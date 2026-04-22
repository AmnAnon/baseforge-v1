// src/app/api/admin/api-keys/route.ts
// Admin API for managing API keys.
// Protected by ADMIN_KEY environment variable (timing-safe compare + rate limiting).
// Supports: GET (list), POST (create), PATCH (toggle/update), DELETE (revoke).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { apiKeys, apiKeyUsage } from "@/lib/db/schema";
import { eq, gte, desc, count } from "drizzle-orm";
import { createApiKeyInDb } from "@/lib/api-key";
import { adminAuthMiddleware } from "@/lib/admin-auth";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────────

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(["free", "pro", "enterprise"]).default("free"),
  rateLimit: z.number().int().positive().max(50000).optional(),
});

// ─── DB connectivity probe ───────────────────────────────────────

async function checkDbConnectivity(): Promise<boolean> {
  try {
    await db.execute("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// ─── GET — List all API keys ────────────────────────────────────

async function handleGet() {
  if (!(await checkDbConnectivity())) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  try {
    const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      tier: apiKeys.tier,
      rateLimit: apiKeys.rateLimit,
      enabled: apiKeys.enabled,
      lastUsedAt: apiKeys.lastUsedAt,
      totalRequests: apiKeys.totalRequests,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));

  // Get usage stats per key (last 24h) — gte = "created at or after 24 h ago"
  const usageStats = await db
    .select({ keyId: apiKeyUsage.keyId, count: count() })
    .from(apiKeyUsage)
    .where(gte(apiKeyUsage.createdAt, new Date(Date.now() - 86_400_000)))
    .groupBy(apiKeyUsage.keyId);

  const usageMap = new Map(usageStats.map((u) => [u.keyId, u.count]));

  return NextResponse.json({
    keys: keys.map((k) => ({
      ...k,
      usage24h: usageMap.get(k.id) ?? 0,
    })),
  });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "query_failed", detail }, { status: 502 });
  }
}

// ─── POST — Create new API key ──────────────────────────────────

async function handlePost(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { raw, record } = await createApiKeyInDb(
    parsed.data.name,
    parsed.data.tier,
    parsed.data.rateLimit
  );

  return NextResponse.json(
    {
      message: "API key created",
      key: raw,
      warning: "Store this key now — it will never be shown again",
      record: {
        id: record.id,
        name: record.name,
        tier: record.tier,
        rateLimit: record.rateLimit,
        createdAt: record.createdAt,
      },
    },
    { status: 201 }
  );
}

// ─── PATCH — Update or toggle key ───────────────────────────────

async function handlePatch(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const PatchSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    rateLimit: z.number().int().positive().max(50000).optional(),
  });

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(apiKeys)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning();

  return NextResponse.json({ key: updated });
}

// ─── DELETE — Revoke key ────────────────────────────────────────

async function handleDelete(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date(), enabled: false, updatedAt: new Date() })
    .where(eq(apiKeys.id, id));

  return NextResponse.json({ message: "Key revoked", id });
}

// ─── Main handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = await adminAuthMiddleware(req);
  if (denied) return denied;
  return handleGet();
}

export async function POST(req: NextRequest) {
  const denied = await adminAuthMiddleware(req);
  if (denied) return denied;
  return handlePost(req);
}

export async function PATCH(req: NextRequest) {
  const denied = await adminAuthMiddleware(req);
  if (denied) return denied;
  return handlePatch(req);
}

export async function DELETE(req: NextRequest) {
  const denied = await adminAuthMiddleware(req);
  if (denied) return denied;
  return handleDelete(req);
}

export const dynamic = "force-dynamic";
