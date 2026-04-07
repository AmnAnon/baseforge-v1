// src/lib/db/seed.ts
// Seeds default alert rules into Postgres on startup if none exist.

import { eq } from "drizzle-orm";
import { db } from "./client";
import { alertRules } from "./schema";

const DEFAULT_RULES = [
  { type: "tvl_drop" as const, protocol: "*", condition: "tvl_change_24h_pct", threshold: "-15", severity: "critical" as const },
  { type: "utilization_spike" as const, protocol: "*", condition: "utilization_pct", threshold: "85", severity: "critical" as const },
  { type: "health_decrease" as const, protocol: "*", condition: "health_score", threshold: "40", severity: "warning" as const },
  { type: "apy_anomaly" as const, protocol: "*", condition: "apy", threshold: "500", severity: "warning" as const },
];

export async function seedDefaultAlertRules() {
  const existing = await db.select({ id: alertRules.id }).from(alertRules).limit(1);
  if (existing.length > 0) return;

  await db.insert(alertRules).values(DEFAULT_RULES);
  console.log("[db/seed] Seeded 4 default alert rules");
}
