// instrumentation.ts
// Server-side Sentry instrumentation and custom Vercel/Next.js lifecycle hooks.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();

    // Log server startup
    console.log(`[server] Starting in ${process.env.NODE_ENV} mode`);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}

export const onRequestError = async (
  error: unknown,
  request: { method: string; url: string }
) => {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, { extra: { request } });
  }
};
