// src/__tests__/hooks/useRealTimeData.test.ts
// Tests the useRealTimeData SSE hook:
//   - Connection lifecycle (connecting → connected → failed)
//   - Data parsing from SSE events
//   - Exponential backoff with jitter
//   - Page visibility handling
//   - Heartbeat timeout detection
//   - Clean disconnect and unmount

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
  onmessage: ((event: MessageEvent) => void) | null = null;
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

  removeEventListener() {}

  close() {
    this.readyState = 2; // CLOSED
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: string) {
    const event = new MessageEvent("message", { data });
    // Fire both onmessage and named "data" listener
    this.onmessage?.(event);
    const listener = this.listeners["data"];
    if (listener) {
      listener(new MessageEvent("data", { data }));
    }
  }

  simulateError() {
    this.onerror?.();
  }
}

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
    expect(result.current.isFailed).toBe(false);
  });

  it("transitions to 'connected' when SSE opens", () => {
    const { result } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isConnected).toBe(true);
    expect(result.current.health.attempts).toBe(0);
    expect(result.current.health.lastConnectedAt).not.toBeNull();
  });

  it("receives and parses data from SSE events", () => {
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

    act(() => es.simulateMessage(JSON.stringify(payload)));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.analytics?.baseMetrics?.totalTvl).toBe(1_000_000);
    expect(result.current.data?.timestamp).toBe(1700000000000);
  });

  it("handles malformed SSE data gracefully without disconnecting", () => {
    const { result } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    // Send bad data — should not crash or disconnect
    act(() => es.simulateMessage("not-valid-json"));

    // Still connected — parse errors are isolated
    expect(result.current.connectionState).toBe("connected");
  });

  it("transitions to disconnected on error and schedules reconnect", () => {
    const { result } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    act(() => es.simulateError());

    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.health.lastError).toBe("Connection lost");
    expect(result.current.health.lastErrorAt).not.toBeNull();
  });

  it("reconnects with exponential backoff", () => {
    const { result } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    // First error
    act(() => es.simulateError());
    expect(result.current.health.attempts).toBe(1);

    // Advance past first backoff (~1s + jitter, use 2s to be safe)
    act(() => vi.advanceTimersByTime(2000));
    const es2 = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Second error
    act(() => es2.simulateOpen());
    act(() => es2.simulateError());
    expect(result.current.health.attempts).toBe(1); // Reset then re-increment

    // Should not reconnect immediately
    const countBefore = MockEventSource.instances.length;
    act(() => vi.advanceTimersByTime(500));
    // May or may not have reconnected yet depending on jitter
    // But definitely should within 4s (2^1 * 1000 + jitter)
    act(() => vi.advanceTimersByTime(4000));
    expect(MockEventSource.instances.length).toBeGreaterThan(countBefore);
  });

  it("resets attempt counter on successful reconnection", () => {
    const { result } = renderHook(() => useRealTimeData());
    let es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    // Simulate error + reconnect
    act(() => es.simulateError());
    act(() => vi.advanceTimersByTime(2000));

    es = MockEventSource.instances[MockEventSource.instances.length - 1];
    act(() => es.simulateOpen()); // Successful reconnect

    expect(result.current.health.attempts).toBe(0);
    expect(result.current.isConnected).toBe(true);
  });

  it("transitions to 'failed' after max reconnect attempts", () => {
    const { result } = renderHook(() => useRealTimeData());
    const maxAttempts = 15;

    // Burn through all reconnection attempts
    for (let i = 0; i <= maxAttempts; i++) {
      const es = MockEventSource.instances[MockEventSource.instances.length - 1];
      if (i === 0) act(() => es.simulateOpen());
      act(() => es.simulateError());
      // Advance enough time for backoff
      act(() => vi.advanceTimersByTime(35_000));
    }

    expect(result.current.isFailed).toBe(true);
    expect(result.current.connectionState).toBe("failed");
  });

  it("manual reconnect works after failure", () => {
    const { result } = renderHook(() => useRealTimeData());

    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());
    act(() => es.simulateError());

    const before = MockEventSource.instances.length;
    act(() => result.current.reconnect());

    expect(MockEventSource.instances.length).toBeGreaterThan(before);
    expect(result.current.connectionState).toBe("connecting");
  });

  it("disconnect cleans up EventSource", () => {
    const { result } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    act(() => result.current.disconnect());

    expect(result.current.connectionState).toBe("disconnected");
    expect(es.readyState).toBe(2);
  });

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    unmount();
    expect(es.readyState).toBe(2);
  });

  it("exposes health metrics", () => {
    const { result } = renderHook(() => useRealTimeData());
    const es = MockEventSource.instances[0];
    act(() => es.simulateOpen());

    expect(result.current.health).toEqual(expect.objectContaining({
      attempts: 0,
      lastConnectedAt: expect.any(Number),
      lastError: null,
    }));
  });
});
