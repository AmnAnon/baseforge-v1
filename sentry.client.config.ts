// This file configures the initialization of Sentry on the client.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Define how likely to experience an error in percentage
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Define how likely Replay is sampled and the rate at which to send errors
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,

  environment: process.env.NODE_ENV,
});
