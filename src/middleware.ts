// src/middleware.ts
// Next.js Edge Middleware — centralized security headers, CORS for agent API,
// and request logging. Rate limiting stays in-process (can't share memory at edge).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Agent API paths that should allow cross-origin access
const CORS_PATHS = ["/api/agents/", "/api/health"];

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
  // ─── CORS preflight for agent API ─────────────────────────────
  if (isCorsPreflight(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = NextResponse.next();

  // ─── CORS headers for agent API responses ─────────────────────
  if (needsCors(request.nextUrl.pathname)) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
  }

  return response;
}

export const config = {
  // Run middleware on API routes only — skip static files and Next internals
  matcher: ["/api/:path*"],
};
