// src/lib/alert-engine.ts
// Evaluates persisted alert rules against live DefiLlama + risk scores.

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertRules, alertEvents, type AlertRule } from "@/lib/db/schema";
import { calculateHealthScore } from "@/lib/risk";
import { logger } from "@/lib/logger";
import { seedDefaultAlertRules } from "@/lib/db/seed";

interface LlamaProtocol {
  slug: string;
  name: string;
  category?: string;
  change_1d?: number;
  change_7d?: number;
  chainTvls?: Record<string, number>;
  audits?: string | number;
  oracles?: string[];
  forkedFrom?: string[];
  apyMean30d?: number;
}

function getBaseTvl(p: LlamaProtocol): number {
  const tvls = p.chainTvls ?? {};
  const key = Object.keys(tvls).find((k) => k.toLowerCase() === "base");
  return key ? (tvls[key] ?? 0) : 0;
}

function matchesProtocol(ruleProtocol: string, slug: string, name: string): boolean {
  if (ruleProtocol === "*") return true;
  const needle = ruleProtocol.toLowerCase();
  return slug.toLowerCase() === needle || slug.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);
}

async function fetchBaseProtocols(): Promise<LlamaProtocol[]> {
  const res = await fetch("https://api.llama.fi/protocols", {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`DefiLlama protocols HTTP ${res.status}`);
  const all: LlamaProtocol[] = await res.json();
  return all.filter((p) => getBaseTvl(p) >= 100_000);
}

function auditCount(p: LlamaProtocol): number {
  if (typeof p.audits === "number") return p.audits;
  if (typeof p.audits === "string") return p.audits.split(",").filter(Boolean).length;
  return 0;
}

function evaluateRule(
  rule: AlertRule,
  proto: LlamaProtocol,
  tvl: number
): { currentValue: number; message: string } | null {
  const threshold = parseFloat(String(rule.threshold));

  switch (rule.condition) {
    case "tvl_change_24h_pct": {
      const change = proto.change_1d ?? 0;
      if (rule.type === "tvl_drop" && change <= threshold) {
        return {
          currentValue: change,
          message: `${proto.name}: TVL ${change >= 0 ? "+" : ""}${change.toFixed(1)}% (24h) — threshold ${threshold}%`,
        };
      }
      if (rule.type === "whale_movement" && Math.abs(change) >= Math.abs(threshold)) {
        return {
          currentValue: change,
          message: `${proto.name}: large flow signal — TVL ${change >= 0 ? "+" : ""}${change.toFixed(1)}% (24h)`,
        };
      }
      return null;
    }
    case "health_score": {
      const { score } = calculateHealthScore({
        audits: auditCount(proto),
        tvl,
        tvlChange24h: proto.change_1d ?? 0,
        tvlChange7d: proto.change_7d ?? 0,
        category: proto.category ?? "Unknown",
        oracles: proto.oracles ?? [],
        forkedFrom: proto.forkedFrom,
        apy: proto.apyMean30d,
      });
      if (score <= threshold) {
        return {
          currentValue: score,
          message: `${proto.name}: health score ${score} (≤ ${threshold})`,
        };
      }
      return null;
    }
    case "apy": {
      const apy = proto.apyMean30d ?? 0;
      if (apy >= threshold) {
        return {
          currentValue: apy,
          message: `${proto.name}: APY ${apy.toFixed(0)}% (≥ ${threshold}%)`,
        };
      }
      return null;
    }
    case "utilization_pct": {
      // Lending utilization requires on-chain markets data — skip until wired
      return null;
    }
    default:
      return null;
  }
}

async function dispatchWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });
}

/** Scan enabled rules and insert alert_events when conditions fire. */
export async function evaluateAlertRules(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;

  await seedDefaultAlertRules();

  const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));
  if (rules.length === 0) return 0;

  let protocols: LlamaProtocol[];
  try {
    protocols = await fetchBaseProtocols();
  } catch (err) {
    logger.warn("[alert-engine] DefiLlama fetch failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return 0;
  }

  let triggered = 0;

  for (const rule of rules) {
    for (const proto of protocols) {
      const tvl = getBaseTvl(proto);
      if (!matchesProtocol(rule.protocol, proto.slug, proto.name)) continue;

      const hit = evaluateRule(rule, proto, tvl);
      if (!hit) continue;

      const cooldownMs = (rule.cooldownMinutes ?? 60) * 60_000;
      const cutoff = new Date(Date.now() - cooldownMs);

      const recent = await db
        .select({ id: alertEvents.id })
        .from(alertEvents)
        .where(
          and(
            eq(alertEvents.ruleId, rule.id),
            eq(alertEvents.protocol, proto.slug),
            gte(alertEvents.triggeredAt, cutoff)
          )
        )
        .limit(1);

      if (recent.length > 0) continue;

      const [event] = await db
        .insert(alertEvents)
        .values({
          ruleId: rule.id,
          protocol: proto.slug,
          network: rule.network,
          currentValue: String(hit.currentValue),
          message: hit.message,
          severity: rule.severity,
        })
        .returning();

      await db
        .update(alertRules)
        .set({ lastTriggered: new Date(), updatedAt: new Date() })
        .where(eq(alertRules.id, rule.id));

      if (rule.webhookUrl && event) {
        dispatchWebhook(rule.webhookUrl, {
          type: rule.type,
          protocol: proto.slug,
          severity: rule.severity,
          message: hit.message,
          currentValue: hit.currentValue,
          eventId: event.id,
          triggeredAt: event.triggeredAt,
        }).catch((err) => {
          logger.warn("[alert-engine] webhook failed", {
            url: rule.webhookUrl,
            error: err instanceof Error ? err.message : "unknown",
          });
        });
      }

      triggered++;
    }
  }

  if (triggered > 0) {
    logger.info("[alert-engine] triggered alerts", { count: triggered });
  }

  return triggered;
}