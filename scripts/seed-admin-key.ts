// scripts/seed-admin-key.ts
// One-shot script: generate a secure admin API key, store its SHA-256
// hash in Neon Postgres, and print the plaintext key to stdout.
//
// Usage:
//   npm run db:seed-admin
//   (DATABASE_URL must be set in .env.local or the shell environment)
//
// The printed key is shown ONCE — copy it to ADMIN_KEY in your env vars.
// Re-running will exit with an error if an admin key already exists.

import { createHash, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

// Append PgBouncer params for Neon serverless
function buildDbUrl(url: string): string {
  if (url.includes("pgbouncer=true")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true&connection_limit=1`;
}

const sql = neon(buildDbUrl(DATABASE_URL));

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function main() {
  // Check for existing admin key
  const existing = await sql`
    SELECT id FROM api_keys
    WHERE tier = 'admin' AND revoked_at IS NULL
    LIMIT 1
  `;

  if (existing.length > 0) {
    console.error(
      "ERROR: An admin key already exists (id=" + existing[0].id + ").",
    );
    console.error(
      "Revoke it first via DELETE /api/admin/api-keys?id=<id> before seeding a new one.",
    );
    process.exit(1);
  }

  // Generate key
  const raw = `bf_admin_${randomBytes(32).toString("hex")}`;
  const hash = sha256(raw);
  const now = new Date().toISOString();

  // Insert into api_keys — rate_limit of 0 means "unlimited" for admin tier
  await sql`
    INSERT INTO api_keys (key, name, tier, rate_limit, enabled, total_requests, created_at, updated_at)
    VALUES (
      ${hash},
      'Admin Key',
      'admin',
      0,
      true,
      0,
      ${now},
      ${now}
    )
  `;

  // Print to stdout exactly once
  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  BaseForge Admin Key Generated");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  ADMIN_KEY=" + raw);
  console.log("");
  console.log("  ⚠  This key will NOT be shown again.");
  console.log("  Copy it to your Vercel environment variables now.");
  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
