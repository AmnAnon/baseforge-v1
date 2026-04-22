// src/lib/admin-auth.ts
// Shared admin authentication and rate-limiting utilities.
//
// Protects /api/admin/* routes from:
//   - Timing-oracle attacks via constant-time comparison
//   - Brute-force key enumeration via per-IP rate limiting
//
// Usage in route handlers:
//   const denied = adminAuthMiddleware(req);
//   if (denied) return denied;

import { timingSafeEqual, createHash } from "crypto";
import { createRateLimiter } from "./rate-limit";

// ─── Brute-force protection ───────────────────────────────────────
// Shared limiter: 10 admin attempts per IP per minute.
// Intentionally stricter than the public API limiter.
// Uses Redis in production (shared across replicas) or in-memory in dev.
const adminBruteForceLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

// ─── Timing-safe compare ──────────────────────────────────────────

/**
 * Compare two strings in constant time to prevent timing-oracle attacks.
 * Both values are hashed with SHA-256 so the comparison is always 32 bytes,
 * even when the strings differ in length.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ─── Public helper ────────────────────────────────────────────────

/**
 * Verify the x-admin-key header against ADMIN_KEY env var.
 * Returns a 403 or 429 Response when access should be denied, or null when
 * the request is authenticated and may proceed.
 *
 * @example
 * export async function GET(req: NextRequest) {
 *   const denied = await adminAuthMiddleware(req);
 *   if (denied) return denied;
 *   // ... handler logic
 * }
 */
export async function adminAuthMiddleware(req: Request): Promise<Response | null> {
  const adminKey = process.env.ADMIN_KEY;

  // Rate-limit in production to prevent brute-force enumeration.
  if (process.env.NODE_ENV === "production") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rl = await adminBruteForceLimiter.check(`admin:${ip}`);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfter: rl.retryAfter }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter ?? 60),
          },
        }
      );
    }
  }

  if (!adminKey) {
    // ADMIN_KEY not configured — deny all admin access to avoid open endpoints.
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-admin-key") ?? "";
  if (!timingSafeStringEqual(provided, adminKey)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null; // authenticated
}
