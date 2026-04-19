// src/lib/db/schema.ts
// Drizzle ORM schema definitions for BaseForge Analytics

import { pgTable, text, integer, numeric, timestamp, boolean, jsonb, uuid, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";

// ─── enums ────────────────────────────────────────────────────────
export const severityEnum = pgEnum("severity", ["critical", "warning", "info"]);
export const alertTypeEnum = pgEnum("alert_type", ["tvl_drop", "utilization_spike", "apy_anomaly", "whale_movement", "health_decrease"]);

// ─── protocols ─────────────────────────────────────────────────────
export const protocols = pgTable(
  "protocols",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull(),
    logoUrl: text("logo_url"),
    chain: text("chain").notNull().default("Base"),
    coingeckoId: text("coingecko_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("protocols_slug_idx").on(table.slug),
    chainIdx: index("protocols_chain_idx").on(table.chain),
  })
);

// ─── historical_tvl ────────────────────────────────────────────────
export const historicalTvl = pgTable(
  "historical_tvl",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    protocolId: uuid("protocol_id")
      .references(() => protocols.id, { onDelete: "cascade" })
      .notNull(),
    timestamp: timestamp("timestamp").notNull(),
    tvl: numeric("tvl", { precision: 20, scale: 2 }).notNull(),
    chain: text("chain").notNull().default("Base"),
    source: text("source").notNull().default("defillama"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tvlTimestampIdx: index("historical_tvl_timestamp_idx").on(table.timestamp),
    tvlProtocolIdx: index("historical_tvl_protocol_idx").on(table.protocolId),
    tvlChainIdx: index("historical_tvl_chain_idx").on(table.chain),
    tvlProtocolTimestampIdx: index("historical_tvl_protocol_ts_idx").on(table.protocolId, table.timestamp),
  })
);

// ─── markets ───────────────────────────────────────────────────────
export const markets = pgTable(
  "markets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    protocolId: uuid("protocol_id")
      .references(() => protocols.id, { onDelete: "cascade" })
      .notNull(),
    asset: text("asset").notNull(),
    supplyApy: numeric("supply_apy", { precision: 10, scale: 6 }),
    borrowApy: numeric("borrow_apy", { precision: 10, scale: 6 }),
    totalSupplyUsd: numeric("total_supply_usd", { precision: 20, scale: 2 }),
    totalBorrowUsd: numeric("total_borrow_usd", { precision: 20, scale: 2 }),
    tvlUsd: numeric("tvl_usd", { precision: 20, scale: 2 }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    marketProtocolIdx: index("markets_protocol_idx").on(table.protocolId),
    marketAssetIdx: index("markets_asset_idx").on(table.asset),
  })
);

// ─── api_cache ─────────────────────────────────────────────────────
export const apiCache = pgTable(
  "api_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    cacheKeyIdx: uniqueIndex("api_cache_key_idx").on(table.key),
    cacheExpiresIdx: index("api_cache_expires_idx").on(table.expiresAt),
  })
);

// ─── user_preferences ──────────────────────────────────────────────
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    favoriteProtocols: jsonb("favorite_protocols").$type<string[]>().default([]),
    settings: jsonb("settings").default({}),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userPrefUserIdx: uniqueIndex("user_prefs_user_idx").on(table.userId),
  })
);

// ─── alert_rules ───────────────────────────────────────────────────
export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: alertTypeEnum("type").notNull(),
    protocol: text("protocol").notNull(),
    network: text("network"),
    condition: text("condition").notNull(),
    threshold: numeric("threshold", { precision: 20, scale: 6 }).notNull(),
    severity: severityEnum("severity").notNull(),
    cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
    enabled: boolean("enabled").notNull().default(true),
    webhookUrl: text("webhook_url"),
    lastTriggered: timestamp("last_triggered"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    enabledIdx: index("alert_rules_enabled_idx").on(table.enabled),
    protocolIdx: index("alert_rules_protocol_idx").on(table.protocol),
    networkIdx: index("alert_rules_network_idx").on(table.network),
  })
);

// ─── frame_interactions ────────────────────────────────────────────
export const frameInteractions = pgTable(
  "frame_interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fid: integer("fid"),
    buttonIndex: integer("button_index").notNull(),
    action: text("action"),
    castFid: integer("cast_fid"),
    castHash: text("cast_hash"),
    messageHash: text("message_hash"),
    address: text("address"),
    tab: text("tab"),
    protocol: text("protocol"),
    route: text("route").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    frameFidIdx: index("frame_interactions_fid_idx").on(table.fid),
    frameRouteIdx: index("frame_interactions_route_idx").on(table.route),
    frameCreatedIdx: index("frame_interactions_created_idx").on(table.createdAt),
    frameTabIdx: index("frame_interactions_tab_idx").on(table.tab),
  })
);

// ─── Type exports ──────────────────────────────────────────────────
export type FrameInteraction = typeof frameInteractions.$inferSelect;
export type NewFrameInteraction = typeof frameInteractions.$inferInsert;

// ─── alert_events ──────────────────────────────────────────────────
export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ruleId: uuid("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
    protocol: text("protocol").notNull(),
    network: text("network"),
    currentValue: numeric("current_value", { precision: 20, scale: 6 }).notNull(),
    message: text("message").notNull(),
    severity: severityEnum("severity").notNull(),
    triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at"),
  },
  (table) => ({
    eventTriggeredIdx: index("alert_events_triggered_idx").on(table.triggeredAt),
    eventProtocolIdx: index("alert_events_protocol_idx").on(table.protocol),
    eventSeverityIdx: index("alert_events_severity_idx").on(table.severity),
    eventDashboardIdx: index("alert_events_dashboard_idx").on(table.severity, table.acknowledged, table.triggeredAt),
    eventNetworkIdx: index("alert_events_network_idx").on(table.network),
  })
);

// ─── api_keys ──────────────────────────────────────────────────────
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),          // SHA-256 hash of the actual key
    name: text("name").notNull(),         // Human-readable label
    tier: text("tier").notNull().default("free"), // "free" | "pro" | "enterprise"
    rateLimit: integer("rate_limit").notNull().default(100), // req/min
    enabled: boolean("enabled").notNull().default(true),
    lastUsedAt: timestamp("last_used_at"),
    totalRequests: integer("total_requests").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    keyIdx: uniqueIndex("api_keys_key_idx").on(table.key),
    tierIdx: index("api_keys_tier_idx").on(table.tier),
    enabledIdx: index("api_keys_enabled_idx").on(table.enabled),
  })
);

// ─── api_key_usage ─────────────────────────────────────────────────
export const apiKeyUsage = pgTable(
  "api_key_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keyId: uuid("key_id")
      .references(() => apiKeys.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull().default("GET"),
    statusCode: integer("status_code"),
    latencyMs: integer("latency_ms"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    keyIdIdx: index("api_key_usage_key_id_idx").on(table.keyId),
    createdAtIdx: index("api_key_usage_created_idx").on(table.createdAt),
    endpointIdx: index("api_key_usage_endpoint_idx").on(table.endpoint),
  })
);

// ─── Type exports ──────────────────────────────────────────────────
export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type NewAlertEvent = typeof alertEvents.$inferInsert;
export type Protocol = typeof protocols.$inferSelect;
export type NewProtocol = typeof protocols.$inferInsert;
export type HistoricalTvl = typeof historicalTvl.$inferSelect;
export type NewHistoricalTvl = typeof historicalTvl.$inferInsert;
export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;
export type ApiCache = typeof apiCache.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;
export type NewApiKeyUsage = typeof apiKeyUsage.$inferInsert;
