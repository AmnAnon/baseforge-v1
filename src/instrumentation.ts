// src/instrumentation.ts
// Server-side Sentry initialization (Node.js runtime hooks for Next.js App Router)

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        environment: process.env.NODE_ENV,
      });
    });

    // Seed default alert rules on startup if no rules exist
    await import("@/lib/db/seed").then(({ seedDefaultAlertRules }) =>
      seedDefaultAlertRules().catch(console.error)
    );
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      });
    });
  }
}
