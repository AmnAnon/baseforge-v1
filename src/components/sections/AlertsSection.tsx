// src/components/sections/AlertsSection.tsx
// Active protocol alerts — TVL drops, utilization spikes, health changes
// Alerts are persisted in Postgres with acknowledge capability.
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { timeAgo, freshnessColor } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Bell,
  BellOff,
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface AlertEvent {
  id: string;
  ruleId: string | null;
  protocol: string;
  network: string | null;
  currentValue: string;
  message: string;
  severity: "critical" | "warning" | "info";
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

interface AlertsResponse {
  alerts: AlertEvent[];
  timestamp: number;
  isStale?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-500/30",
    label: "CRITICAL",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/30",
    label: "WARNING",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-500/30",
    label: "INFO",
  },
};

export default function AlertsSection() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setError(null);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const acknowledgeAlert = async (eventId: string) => {
    setAcknowledging(eventId);
    try {
      const res = await fetch("/api/alerts/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error(`Failed to acknowledge: ${res.status}`);
      // Optimistic update — remove from visible list
      setData((prev) =>
        prev
          ? {
              ...prev,
              alerts: prev.alerts.filter((a) => a.id !== eventId),
            }
          : null
      );
    } catch (err) {
      console.error("[Alerts] Acknowledge error:", err);
    } finally {
      setAcknowledging(null);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAlerts, 120000); // Check every 2 min
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (error) {
    return (
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Active Alerts</h2>
        <Card className="p-6 bg-red-900/20 border-red-500/30">
          <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
          <p className="text-red-400">Could not check alerts</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button onClick={fetchAlerts} className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm">
            Retry
          </button>
        </Card>
      </section>
    );
  }

  const activeAlerts = data?.alerts.filter((a) => !a.acknowledged) ?? [];
  const criticalCount = activeAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = activeAlerts.filter((a) => a.severity === "warning").length;

  const displayedAlerts = showAcknowledged
    ? data?.alerts ?? []
    : activeAlerts;

  return (
    <section className="space-y-6" aria-labelledby="alerts-heading">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="alerts-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-yellow-400" />
            Active Alerts
          </h2>
          <p className="text-sm text-gray-400">
            {criticalCount} critical, {warningCount} warnings across Base protocols
          </p>
          {data?.timestamp && (
            <div className={`text-xs ${freshnessColor(data.timestamp)} mt-1`}>
              {timeAgo(data.timestamp)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAcknowledged(!showAcknowledged)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              showAcknowledged
                ? "bg-slate-800 text-slate-300 border border-slate-700"
                : "bg-gray-800 text-gray-500 border border-gray-700"
            }`}
          >
            {showAcknowledged ? "Hide acknowledged" : "Show acknowledged"}
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-colors ${
              autoRefresh ? "bg-emerald-900/30 text-emerald-400" : "bg-gray-800 text-gray-500"
            }`}
            aria-label={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
          >
            {autoRefresh ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <button
            onClick={fetchAlerts}
            disabled={isLoading}
            className="p-2 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh alerts"
          >
            <RefreshCw className={`h-5 w-5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <Card className="p-6 bg-red-900/20 border-red-500/30">
          <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
          <p className="text-red-400">Could not check alerts</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button
            onClick={fetchAlerts}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm"
          >
            Retry
          </button>
        </Card>
      )}

      {isLoading && !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 bg-gray-900/60 border-gray-800">
              <div className="flex items-start gap-3">
                <Skeleton variant="line" className="w-5 h-5 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton variant="line" className="w-16 h-3" />
                    <Skeleton variant="line" className="w-24 h-3" />
                  </div>
                  <Skeleton variant="line" className="w-3/4 h-3" />
                  <Skeleton variant="line" className="w-20 h-2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : displayedAlerts.length === 0 ? (
        <Card className="p-8 bg-emerald-900/10 border-emerald-500/20 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-emerald-400 font-medium">All clear — no active alerts</p>
          <p className="text-sm text-gray-500 mt-1">Protocol conditions within normal ranges</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedAlerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity];
            const Icon = config.icon;
            return (
              <Card
                key={alert.id}
                className={`${config.bg} ${config.border} p-4 ${
                  alert.acknowledged ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 ${config.color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-sm font-medium text-white">{alert.protocol}</span>
                      {alert.network && (
                        <span className="text-xs text-gray-500 px-2 py-0.5 rounded border border-gray-700">
                          {alert.network}
                        </span>
                      )}
                      {alert.acknowledged && (
                        <span className="text-xs text-gray-500">
                          acknowledged {timeAgo(new Date(alert.acknowledgedAt!).getTime())}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {timeAgo(new Date(alert.triggeredAt).getTime())}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      disabled={acknowledging === alert.id}
                      className="p-2 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Acknowledge alert"
                    >
                      <Check className={`h-4 w-4 text-emerald-400 ${
                        acknowledging === alert.id ? "animate-spin" : ""
                      }`} />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
