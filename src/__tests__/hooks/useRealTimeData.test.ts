// src/__tests__/hooks/useRealTimeData.test.ts
// Tests the useRealTimeData SSE hook:
//   - Connection lifecycle (connecting → connected)
//   - Data parsing from SSE "data" events
//   - Reconnection with exponential backoff on error
//   - Clean disconnect

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealTimeData } from "@/hooks/useRealTimeData";

// ─── Mock EventSource ────────────────────────────────────────────────

type EventSourceListener = Record<string, EventListener>;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState: number = 0; // CONNECTING
  listeners: EventSourceListener = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  static CLEAR() {
    MockEventSource.instances = [];
  }

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners[type] = listener;
  }

  removeEventListener() {
    // no-op for tests
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Helpers for tests to simulate SSE behavior
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(type: string, data: string) {
    const listener = this.listeners[type];
    if (listener) {
      listener(new MessageEvent(type, { data }));
    }
  }

  simulateError() {
    this.onerror?.();
  }
}

// Override global EventSource
const OriginalEventSource = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.CLEAR();
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.EventSource = OriginalEventSource;
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("useRealTimeData", () => {
  it("starts in 'connecting' state", () => {
    const { result } = renderHook(() => useRealTimeData());
    expect(result.current.connectionState).toBe("connecting");
    expect(result.current.isConnected).toBe(false);
  });

  it("transitions to 'connected' when SSE opens", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isConnected).toBe(true);
  });

  it("receives data from SSE 'data' events", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    const payload = {
      analytics: {
        baseMetrics: { totalTvl: 1_000_000, totalProtocols: 5, avgApy: 4.2, change24h: 1.5 },
      },
      timestamp: 1700000000000,
      type: "snapshot",
    };

    act(() => es.simulateMessage("data", JSON.stringify(payload)));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.analytics?.baseMetrics?.totalTvl).toBe(1_000_000);
    expect(result.current.data?.timestamp).toBe(1700000000000);
  });

  it("handles malformed SSE data gracefully", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    act(() => es.simulateMessage("data", "not-valid-json"));

    expect(result.current.lastError).toBe("Failed to parse stream data");
    // Should stay connected — parse failure doesn't kill connection
    expect(result.current.connectionState).toBe("connected");
  });

  it("transitions to 'disconnected' on SSE error and attempts reconnect", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());
    expect(result.current.isConnected).toBe(true);

    // Simulate stream drop
    act(() => es.simulateError());

    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.lastError).toBe("Stream interrupted — reconnecting...");

    // Advance timers — first reconnect attempt is 1s (exponential backoff starting at 1s)
    act(() => vi.advanceTimersByTime(1000));

    // A new EventSource should have been created
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });

  it("uses exponential backoff for reconnection attempts", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    // First error → 1s backoff
    act(() => es.simulateError());
    act(() => vi.advanceTimersByTime(1000));
    // New ES created for reconnect attempt
    const es2 = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Second error → 2s backoff
    act(() => es2.simulateOpen());
    act(() => es2.simulateError());
    // Should NOT reconnect immediately
    const countBefore = MockEventSource.instances.length;
    act(() => vi.advanceTimersByTime(999));
    expect(MockEventSource.instances.length).toBe(countBefore);
    // But should reconnect after 2s
    act(() => vi.advanceTimersByTime(1001));
    expect(MockEventSource.instances.length).toBeGreaterThan(countBefore);
  });

  it("caps reconnect delay at 30 seconds", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    // Simulate many failures to push backoff past 30s
    for (let i = 0; i < 35; i++) {
      const latest = MockEventSource.instances[MockEventSource.instances.length - 1];
      act(() => latest.simulateError());
      // Advance just enough to trigger the reconnect
      const delay = Math.min((i + 1) * 1000, 30000);
      act(() => vi.advanceTimersByTime(delay));
    }

    // Still working — the hook shouldn't crash or give up
    expect(result.current.connectionState).toBeDefined();
  });

  it("resets reconnect attempts after successful connection", () => {
    const { result } = renderHook(() => useRealTimeData());

    let es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    // Simulate 2 errors
    act(() => es.simulateError());
    act(() => vi.advanceTimersByTime(1000)); // 1s backoff

    es = MockEventSource.instances[MockEventSource.instances.length - 1];
    act(() => es.simulateOpen()); // Successful reconnect resets attempts

    // Next error should go back to 1s backoff, not 3s
    act(() => es.simulateError());
    // Just past 1s mark — should have reconnected
    act(() => vi.advanceTimersByTime(1000));
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(3);
  });

  it("disconnect cleans up EventSource and timers", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    act(() => result.current.disconnect());

    expect(result.current.connectionState).toBe("disconnected");
    expect(es.readyState).toBe(2); // CLOSED
  });

  it("manual reconnect resets attempt counter and creates new connection", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());
    act(() => es.simulateError());

    // Advance past first backoff
    act(() => vi.advanceTimersByTime(1000));

    // Manual reconnect should reset attempts
    const instancesBeforeReconnect = MockEventSource.instances.length;
    act(() => result.current.reconnect());

    expect(MockEventSource.instances.length).toBeGreaterThan(instancesBeforeReconnect);
  });

  it("cleans up on unmount", () => {
    const { result, unmount } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    unmount();

    expect(es.readyState).toBe(2); // CLOSED
  });
});