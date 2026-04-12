/**
 * useRealTimeData — SSE hook with production-grade reconnection.
 *
 * Features:
 * - Exponential backoff with jitter (1s → 30s cap)
 * - Page visibility-aware (pause when hidden, reconnect when visible)
 * - Heartbeat monitoring (detect silent connection drops)
 * - Connection health metrics (attempts, uptime)
 * - Max retry limit with manual reconnect fallback
 * - Structured event parsing with error isolation
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface StreamData {
  analytics?: {
    baseMetrics?: { totalTvl: number; totalProtocols: number; avgApy: number; change24h: number };
    tvlHistory?: { date: string; tvl: number }[];
    protocols?: Array<{ id: string; name: string; tvl: number; change24h: number; category: string }>;
    protocolData?: Record<string, { tvl: number; tvlChange: number; totalBorrow: number; utilization: number; feesAnnualized: number; revenueAnnualized: number; tokenPrice: number | null }>;
  };
  prices?: Record<string, { usd: number }>;
  whales?: Array<Record<string, unknown>>;
  timestamp?: number;
  type?: string;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

interface ConnectionHealth {
  attempts: number;
  lastConnectedAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  uptimeMs: number;
}

const MAX_RECONNECT_ATTEMPTS = 15;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 90_000;

function backoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = exponential * 0.3 * (Math.random() * 2 - 1);
  return Math.round(exponential + jitter);
}

export function useRealTimeData() {
  const [data, setData] = useState<StreamData | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [health, setHealth] = useState<ConnectionHealth>({
    attempts: 0,
    lastConnectedAt: null,
    lastErrorAt: null,
    lastError: null,
    uptimeMs: 0,
  });

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const connectedAtRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Use refs to break circular dependency between callbacks
  const connectRef = useRef<() => void>(() => {});
  const scheduleReconnectRef = useRef<() => void>(() => {});

  // ── Heartbeat: detect silent drops ──────────────────────────

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      esRef.current?.close();
      setConnectionState("disconnected");
      setHealth((h) => ({
        ...h,
        lastError: "Heartbeat timeout — no data in 90s",
        lastErrorAt: Date.now(),
      }));
      scheduleReconnectRef.current();
    }, HEARTBEAT_TIMEOUT_MS);
  }, []);

  // ── Reconnection scheduling ─────────────────────────────────

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionState("failed");
      setHealth((h) => ({
        ...h,
        lastError: `Max reconnection attempts reached (${MAX_RECONNECT_ATTEMPTS})`,
        lastErrorAt: Date.now(),
      }));
      return;
    }

    const delay = backoffDelay(attemptsRef.current);
    attemptsRef.current++;
    setHealth((h) => ({ ...h, attempts: attemptsRef.current }));

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connectRef.current();
    }, delay);
  }, []);

  // ── Core connection logic ───────────────────────────────────

  const connect = useCallback(() => {
    esRef.current?.close();
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);

    if (!mountedRef.current) return;
    setConnectionState("connecting");

    const es = new EventSource("/api/stream");
    esRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) { es.close(); return; }
      setConnectionState("connected");
      attemptsRef.current = 0;
      connectedAtRef.current = Date.now();
      setHealth({
        attempts: 0,
        lastConnectedAt: Date.now(),
        lastError: null,
        lastErrorAt: null,
        uptimeMs: 0,
      });
      resetHeartbeat();
    };

    es.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data) as StreamData;
        setData(parsed);
        setConnectionState("connected");
        resetHeartbeat();
        if (connectedAtRef.current) {
          setHealth((h) => ({ ...h, uptimeMs: Date.now() - (connectedAtRef.current || Date.now()) }));
        }
      } catch {
        // Malformed data — ignore silently
      }
    };

    es.addEventListener("data", (event: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data) as StreamData;
        setData(parsed);
        setConnectionState("connected");
        resetHeartbeat();
      } catch {
        // Ignore malformed
      }
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      connectedAtRef.current = null;
      setConnectionState("disconnected");
      setHealth((h) => ({
        ...h,
        lastError: "Connection lost",
        lastErrorAt: Date.now(),
        uptimeMs: 0,
      }));
      scheduleReconnectRef.current();
    };
  }, [resetHeartbeat]);

  // Keep refs in sync
  useEffect(() => { connectRef.current = connect; }, [connect]);
  useEffect(() => { scheduleReconnectRef.current = scheduleReconnect; }, [scheduleReconnect]);

  // ── Page visibility: pause when hidden ──────────────────────

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        esRef.current?.close();
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      } else {
        attemptsRef.current = 0;
        connectRef.current();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Lifecycle ───────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    esRef.current?.close();
    esRef.current = null;
    connectedAtRef.current = null;
    setConnectionState("disconnected");
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    attemptsRef.current = 0;
    setConnectionState("connecting");
    connectRef.current();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connectRef.current();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      esRef.current?.close();
    };
  }, []);

  return {
    data,
    connectionState,
    health,
    reconnect,
    disconnect,
    isConnected: connectionState === "connected",
    isFailed: connectionState === "failed",
  };
}
