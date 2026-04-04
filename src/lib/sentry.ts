// src/lib/sentry.ts
// Sentry configuration for error tracking and server instrumentation.
// Set NEXT_PUBLIC_SENTRY_DSN + SENTRY_AUTH_TOKEN in env.

import * as Sentry from "@sentry/nextjs";

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Adjust sample rate based on environment
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0,

      environment: process.env.NODE_ENV,
      enabled: process.env.NODE_ENV !== "test",
    });
  }
}
