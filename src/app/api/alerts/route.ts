// src/app/api/alerts/route.ts
// Alert check engine — scans Base protocols for trigger conditions
// Used by both UI alerts tab and optional push notifications
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";

interface AlertRule {
  id: string;
  type: "tvl_drop" | "utilization_spike" | "apy_anomaly" | "whale_movement" | "health_decrease";
  protocol: string;
  condition: string;
  threshold: number;
  severity: "critical" | "warning" | "info";
}

interface AlertEvent {
  rule: AlertRule;
  protocol: string;
  currentValue: number;
  message: string;
  triggeredAt: number;
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: "tvl-drop", type: "tvl_drop", protocol: "*", condition: "tvl_change_24h_pct", threshold: -15, severity: "critical" },
  { id: "util-spike", type: "utilization_spike", protocol: "*", condition: "utilization_pct", threshold: 85, severity: "critical" },
  { id: "health-dec", type: "health_decrease", protocol: "*", condition: "health_score", threshold: 40, severity: "warning" },
  { id: "high-apy", type: "apy_anomaly", protocol: "*", condition: "apy", threshold: 500, severity: "warning" },
];

export async function GET(req: Request) {
  try {
    const alerts = await cache.getOrFetch("alert-checks", CACHE_TTL.TVL_HISTORY, async () => {
      const [protocolsRes] = await Promise.all([
        fetch("https://api.llama.fi/protocols", { cache: "no-store" }),
      ]);

      if (!protocolsRes.ok) throw new Error("Failed to fetch protocols");

      const protocols = await protocolsRes.json();
      const events: AlertEvent[] = [];

      const baseProtos = protocols.filter(
        (p: { chainTvls?: Record<string, number> }) => (p.chainTvls?.Base || 0) > 1_000_000
      );

      for (const proto of baseProtos) {
        const name = proto.name;
        const tvl = proto.chainTvls.Base || 0;
        const change24h = proto.change_1d || 0;

        // TVL drop alert
        if (change24h < -15) {
          events.push({
            rule: DEFAULT_ALERT_RULES[0],
            protocol: name,
            currentValue: change24h,
            message: `${name} TVL dropped ${change24h.toFixed(1)}% in 24h`,
            triggeredAt: Date.now(),
          });
        }

        // Health decrease alert (simplified: no audits + declining TVL)
        const audits = proto.audits || 0;
        const change7d = proto.change_7d || 0;
        if (audits === 0 && change7d < -10) {
          const healthEstimate = Math.max(0, 50 + audits * 5 + (change7d < -10 ? -10 : 0));
          events.push({
            rule: DEFAULT_ALERT_RULES[2],
            protocol: name,
            currentValue: healthEstimate,
            message: `${name} health score estimated at ${healthEstimate} (unaudited + declining TVL)`,
            triggeredAt: Date.now(),
          });
        }
      }

      return events;
    });

    return NextResponse.json({ alerts, timestamp: Date.now() });
  } catch (err) {
    console.error("Alerts API error:", err);
    return NextResponse.json({ error: "Alert check failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { protocol, ruleType, threshold } = body;

    // In a production app, save to a persistent store (Upstash, etc.)
    // For now, return the custom rule that would trigger
    const customRule: AlertRule | null = {
      id: `custom-${Date.now()}`,
      type: ruleType,
      protocol,
      condition: ruleType,
      threshold,
      severity: threshold > 0 ? "info" : "critical",
    };

    return NextResponse.json({ rule: customRule });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
