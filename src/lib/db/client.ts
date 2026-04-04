// src/lib/db/client.ts
// Drizzle ORM client with Neon Postgres connection.
// Falls back to undefined when DATABASE_URL is not set (dev without DB).

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

export const db = DATABASE_URL
  ? drizzle(neon(DATABASE_URL))
  : undefined;

export type DbClient = Awaited<ReturnType<typeof drizzle>> | undefined;
