// src/test/setup.ts
// Test setup — RTL matchers, MSW server, global mocks.

import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { mockServer } from "../__tests__/mocks/server";

// ── MSW lifecycle ───────────────────────────────────────────────

beforeAll(() => mockServer.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

// ── Global polyfills ────────────────────────────────────────────

// EventSource polyfill for SSE hook tests
class MockEventSource {
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = this.CLOSED;
  }

  addEventListener(_type: string, _listener: (ev: MessageEvent) => void) {
    // No-op for tests
  }

  removeEventListener() {
    // No-op
  }
}

// Only polyfill if not present (jsdom doesn't provide it)
if (typeof globalThis.EventSource === "undefined") {
  // @ts-expect-error — mock EventSource for SSR compatibility
  globalThis.EventSource = MockEventSource;
}

// AbortSignal.timeout polyfill (Node 20+ has it, but jsdom may not)
if (!AbortSignal.timeout) {
  // @ts-expect-error — polyfill
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("timeout")), ms);
    return controller.signal;
  };
}

// ── Suppress console noise in tests ─────────────────────────────

// Silence structured clone warnings in jsdom
vi.spyOn(console, "warn").mockImplementation(() => {});

// Silence logger in tests (override in specific tests)
vi.spyOn(console, "debug").mockImplementation(() => {});
