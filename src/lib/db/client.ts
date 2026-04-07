// src/lib/db/client.ts
// Drizzle ORM client with Neon Postgres connection.
// Fails fast if DATABASE_URL is not set — no silent fallbacks.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Set it in .env.local or your deployment environment.");
}

export const db = drizzle(neon(DATABASE_URL));

export type DbClient = Awaited<ReturnType<typeof drizzle>>;
