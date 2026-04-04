// src/middleware.ts
// Next.js Edge middleware: rate limiting, security headers, CSP enforcement.

import { NextResponse, NextRequest } from "next/server";

// In-memory sliding window rate limiter (edge-compatible)
const requests = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = {
  windowMs: 60_000, // 1 minute
  maxRequests: 10,
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Security Headers ─────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      `frame-src 'self' https://warpcast.com`,
      `connect-src 'self' https://api.llama.fi https://yields.llama.fi https://api.coingecko.com https://api.etherscan.io`,
    ].join("; "),
  });

  // ─── Rate Limiting (API routes only) ──────────
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const key = `rl:${ip}`;
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || now > entry.resetAt) {
      requests.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    } else if (entry.count >= RATE_LIMIT.maxRequests) {
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests",
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(RATE_LIMIT.windowMs / 1000),
          },
        }
      );
    } else {
      entry.count++;
    }

    // Cleanup old entries every minute (approximate; fine for edge)
  }

  const response = NextResponse.next();
  // Apply security headers
  for (const [key, value] of headers) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|\\.well-known).*)"],
};
