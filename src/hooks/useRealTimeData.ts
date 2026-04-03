/**
 * Server-Sent Events Hook
 * 
 * Replaces 60s polling with real-time push:
 *   - Client connects once to /api/stream
 *   - Server pushes updates every 30s
 *   - Auto-reconnects on disconnect
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface StreamData {
  analytics?: {
    baseMetrics?: { totalTvl: number; totalProtocols: number; avgApy: number; change24h: number };
    tvlHistory?: { date: string; tvl: number }[];
    protocols?: Array<{ id: string; name: string; tvl: number; change24h: number; category: string }>;
  };
  prices?: Record<string, { usd: number }>;
  whales?: Array<Record<string, unknown>>;
  timestamp?: number;
  type?: string;
}

type ConnectionState = "connecting" | "connected" | "disconnected";

export function useRealTimeData() {
  const [data, setData] = useState<StreamData | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | undefined>(undefined);

  const connect = useCallback(() => {
    esRef.current?.close();
    setConnectionState("connecting");

    const es = new EventSource("/api/stream");
    esRef.current = es;

    es.onopen = () => setConnectionState("connected");

    es.addEventListener("data", (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as StreamData;
        setData(parsed);
        setConnectionState("connected");
        setLastError(null);
      } catch {
        setLastError("Failed to parse stream data");
      }
    });

    es.onerror = () => {
      setConnectionState("disconnected");
      setLastError("Stream interrupted — reconnecting...");
      es.close();

      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current !== undefined) {
      clearTimeout(reconnectTimerRef.current);
    }
    esRef.current?.close();
    esRef.current = null;
    setConnectionState("disconnected");
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current !== undefined) {
      clearTimeout(reconnectTimerRef.current);
    }
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current !== undefined) {
        clearTimeout(reconnectTimerRef.current);
      }
      esRef.current?.close();
    };
  }, [connect]);

  return {
    data,
    connectionState,
    lastError,
    reconnect,
    disconnect,
    isConnected: connectionState === "connected",
  };
}
