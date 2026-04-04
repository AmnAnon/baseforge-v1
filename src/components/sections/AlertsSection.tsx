// src/components/sections/AlertsSection.tsx
// Active protocol alerts — TVL drops, utilization spikes, health changes
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency, timeAgo, freshnessColor } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Bell,
  BellOff,
} from "lucide-react";

interface AlertEvent {
  rule: {
    id: string;
    type: string;
    severity: "critical" | "warning" | "info";
  };
  protocol: string;
  currentValue: number;
  message: string;
  triggeredAt: number;
}

interface AlertsResponse {
  alerts: AlertEvent[];
  timestamp: number;
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

  const fetchAlerts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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

  const criticalCount = data?.alerts.filter(a => a.rule.severity === "critical").length || 0;
  const warningCount = data?.alerts.filter(a => a.rule.severity === "warning").length || 0;

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

      {data?.alerts.length === 0 ? (
        <Card className="p-8 bg-emerald-900/10 border-emerald-500/20 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-emerald-400 font-medium">All clear — no active alerts</p>
          <p className="text-sm text-gray-500 mt-1">Protocol conditions within normal ranges</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.alerts.map((alert, i) => {
            const config = SEVERITY_CONFIG[alert.rule.severity];
            const Icon = config.icon;
            return (
              <Card
                key={i}
                className={`${config.bg} ${config.border} p-4`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 ${config.color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-sm font-medium text-white">{alert.protocol}</span>
                    </div>
                    <p className="text-sm text-gray-300">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {timeAgo(alert.triggeredAt)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
