// src/lib/validation.ts
// Response validation helpers — wire Zod schemas into API routes.
// Pattern: validateResponse(schema, rawData, fallback, loggerLabel)

import { z } from "zod";
import { logger } from "./logger";

export function validateOrFallback<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T,
  label: string
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  logger.warn(`${label}: validation failed, using fallback`, {
    errors: result.error.issues.length,
    path: result.error.issues[0]?.path?.join("."),
  });
  return fallback;
}

export function safeParseOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  label: string
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  logger.error(`${label}: invalid response`, {
    errors: result.error.issues.map((i) => ({ path: i.path.join("."), msg: i.message })),
  });
  throw new Error(`${label}: response validation failed`);
}

// Cache headers to return with NextResponse
export function cacheHeaders(ttlSeconds: number, isStale?: boolean) {
  const maxAge = isStale ? 0 : ttlSeconds;
  const staleWhileRevalidate = ttlSeconds * 2;
  return {
    "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    "X-Cache-Status": isStale ? "STALE" : "HIT",
  };
}
