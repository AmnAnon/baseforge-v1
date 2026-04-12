// src/lib/db/client.ts
// Drizzle ORM client with Neon Postgres connection.
// Lazy-initialized: only throws when the DB is actually used without DATABASE_URL.
// Routes that don't need the DB won't crash on import.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

export type DbClient = ReturnType<typeof drizzle>;

let _db: DbClient | null = null;

export function getDb(): DbClient {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required. Set it in .env.local or your deployment environment.");
  }
  _db = drizzle(neon(url));
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
