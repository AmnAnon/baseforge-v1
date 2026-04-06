// instrumentation.ts — Sentry server-side initialization.
// Next.js automatically picks up this file at startup.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import and run Sentry init on startup
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime — Sentry is initialized via the Sentry Next.js SDK middleware
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}
