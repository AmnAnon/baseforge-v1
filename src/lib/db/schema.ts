// src/lib/db/schema.ts
// Drizzle ORM schema definitions for BaseForge Analytics

import { pgTable, text, integer, numeric, timestamp, serial, boolean, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

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

// ─── Type exports ──────────────────────────────────────────────────
export type Protocol = typeof protocols.$inferSelect;
export type NewProtocol = typeof protocols.$inferInsert;
export type HistoricalTvl = typeof historicalTvl.$inferSelect;
export type NewHistoricalTvl = typeof historicalTvl.$inferInsert;
export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;
export type ApiCache = typeof apiCache.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
