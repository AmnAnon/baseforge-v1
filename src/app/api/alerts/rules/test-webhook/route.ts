// src/app/api/alerts/rules/test-webhook/route.ts
// POST — send a test webhook payload (admin-authenticated, SSRF-protected).
// Body: { webhookUrl: string, ruleId?: string }

import { NextResponse } from "next/server";
import { adminAuthMiddleware } from "@/lib/admin-auth";
import { validateWebhookUrl } from "@/lib/webhook-url";

export async function POST(req: Request) {
  const denied = await adminAuthMiddleware(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { webhookUrl, ruleId } = body as { webhookUrl?: string; ruleId?: string };

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
    }

    const check = await validateWebhookUrl(webhookUrl);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const payload = {
      event: "test",
      source: "baseforge",
      ruleId: ruleId ?? "test",
      protocol: "test-protocol",
      severity: "info",
      message: "This is a test webhook from BaseForge Alerts. If you see this, delivery is working.",
      currentValue: 0,
      threshold: 0,
      triggeredAt: new Date().toISOString(),
    };

    const res = await fetch(check.url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "BaseForge-Alerts/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Webhook responded with ${res.status}`, status: res.status },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook delivery failed: ${msg}` }, { status: 502 });
  }
}