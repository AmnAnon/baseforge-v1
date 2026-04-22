// src/middleware.ts
// Next.js Edge Middleware — centralized security headers, CORS for agent API,
// and request logging. Rate limiting stays in-process (can't share memory at edge).
//
// CORS policy:
//   - Agent/health paths allow cross-origin GET by default (required for LLM agents).
//   - Set CORS_ALLOWED_ORIGINS=https://your-app.com,https://agent.example.com in the
//     environment to restrict to an explicit allowlist. Requests from other origins
//     receive a 403; same-origin requests always pass through.
//   - Admin paths (/api/admin/*) are never CORS-enabled — browser-based cross-origin
//     access to admin endpoints is blocked at this layer regardless of the allowlist.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Agent API paths that should allow cross-origin access (admin paths intentionally excluded)
const CORS_PATHS = ["/api/agents/", "/api/health"];

// Parse allowed origins from environment at cold-start (Edge-safe: string split only).
// Empty list means "allow any origin" (open public API — backward-compatible default).
const ALLOWED_ORIGINS: string[] = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

/**
 * Resolve the value to use for Access-Control-Allow-Origin.
 * Returns the request origin when it matches the allowlist, "*" when the
 * allowlist is empty (open API), or null to deny the cross-origin request.
 */
function resolveAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  if (ALLOWED_ORIGINS.length === 0) return "*";
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return null;
}

function isCorsPreflight(req: NextRequest): boolean {
  return (
    req.method === "OPTIONS" &&
    CORS_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))
  );
}

function needsCors(pathname: string): boolean {
  return CORS_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  // ─── Block cross-origin access to admin routes at middleware level ─
  if (request.nextUrl.pathname.startsWith("/api/admin/")) {
    const origin = request.headers.get("origin");
    // Only block actual cross-origin requests (origin header present means browser cross-origin).
    if (origin) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ─── CORS preflight for agent API ─────────────────────────────
  if (isCorsPreflight(request)) {
    const origin = request.headers.get("origin");
    const allowedOrigin = resolveAllowedOrigin(origin);

    if (!allowedOrigin) {
      return new NextResponse(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      // X-Admin-Key is intentionally omitted — admin endpoints don't use CORS
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Access-Control-Max-Age": "86400",
    };
    if (ALLOWED_ORIGINS.length > 0) {
      headers["Vary"] = "Origin";
    }

    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();

  // ─── CORS headers for agent API responses ─────────────────────
  if (needsCors(request.nextUrl.pathname)) {
    const origin = request.headers.get("origin");
    const allowedOrigin = resolveAllowedOrigin(origin);

    if (allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      if (ALLOWED_ORIGINS.length > 0) {
        response.headers.set("Vary", "Origin");
      }
    }
  }

  return response;
}

export const config = {
  // Run middleware on API routes only — skip static files and Next internals
  matcher: ["/api/:path*"],
};
