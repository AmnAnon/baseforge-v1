// src/lib/db/client.ts
// Drizzle ORM client with Neon Postgres connection.
// Lazy-initialized: only throws when the DB is actually used without DATABASE_URL.
// Routes that don't need the DB won't crash on import.

import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

let _db: DbClient | null = null;

export function getDb(): DbClient {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required. Set it in .env.local or your deployment environment.");
  }
  if (url.includes("neon.tech")) {
    const pooledUrl = url.includes("pgbouncer=true")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true&connection_limit=1`;
    _db = drizzleNeon(neon(pooledUrl));
  } else {
    _db = drizzlePostgres(postgres(url));
  }
  return _db;
}

/**
 * Convenience export — lazy proxy that throws only on first actual use if DATABASE_URL is missing.
 * Keeps existing `import { db } from "@/lib/db/client"` working everywhere.
 */
export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
