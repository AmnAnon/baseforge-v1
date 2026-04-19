// src/components/sections/AlertsSection.tsx
// Active protocol alerts — TVL drops, utilization spikes, health changes.
// Two tabs: "Active Alerts" (events) and "Rules" (create / manage / test webhook).
"use client";

import { useEffect, useState, useCallback } from "react";
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
  Plus,
  Trash2,
  Send,
  Settings2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── Types ──────────────────────────────────────────────────────

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

interface AlertRule {
  id: string;
  type: string;
  protocol: string;
  network: string | null;
  condition: string;
  threshold: string;
  severity: "critical" | "warning" | "info";
  cooldownMinutes: number;
  enabled: boolean;
  webhookUrl: string | null;
  lastTriggered: string | null;
  createdAt: string;
}

interface AlertsResponse {
  alerts: AlertEvent[];
  timestamp: number;
  isStale?: boolean;
}

interface RulesResponse {
  rules: AlertRule[];
}

// ─── Constants ──────────────────────────────────────────────────

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

const ALERT_TYPES = [
  { value: "tvl_drop",          label: "TVL Drop" },
  { value: "utilization_spike", label: "Utilization Spike" },
  { value: "apy_anomaly",       label: "APY Anomaly" },
  { value: "whale_movement",    label: "Whale Movement" },
  { value: "health_decrease",   label: "Health Decrease" },
];

const CONDITION_OPTIONS: Record<string, { value: string; label: string }[]> = {
  tvl_drop:          [{ value: "tvl_change_24h_pct", label: "24h TVL change (%)" }],
  utilization_spike: [{ value: "utilization_pct",    label: "Utilization (%)" }],
  apy_anomaly:       [{ value: "apy",                label: "APY (%)" }],
  health_decrease:   [{ value: "health_score",       label: "Health score" }],
  whale_movement:    [{ value: "tvl_change_24h_pct", label: "24h TVL change (%)" }],
};

// ─── Create Rule Form ────────────────────────────────────────────

function CreateRuleForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType]             = useState("tvl_drop");
  const [protocol, setProtocol]     = useState("");
  const [condition, setCondition]   = useState("tvl_change_24h_pct");
  const [threshold, setThreshold]   = useState("");
  const [severity, setSeverity]     = useState<"critical" | "warning" | "info">("warning");
  const [cooldown, setCooldown]     = useState("60");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  // When type changes, reset condition to first option
  useEffect(() => {
    const opts = CONDITION_OPTIONS[type] ?? [];
    if (opts.length > 0) setCondition(opts[0].value);
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          protocol: protocol.trim() || "*",
          condition,
          threshold: parseFloat(threshold),
          severity,
          cooldownMinutes: parseInt(cooldown, 10),
          webhookUrl: webhookUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `API error ${res.status}`);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setProtocol("");
      setThreshold("");
      setWebhookUrl("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Alert type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {ALERT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Protocol slug (or * for all)</label>
          <input
            type="text"
            placeholder="e.g. aave-v3 or *"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Condition</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
            {(CONDITION_OPTIONS[type] ?? []).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Threshold</label>
          <input
            type="number"
            step="any"
            required
            placeholder="e.g. -10"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className={inputCls}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Cooldown (minutes)</label>
          <input
            type="number"
            min="1"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Webhook URL (optional)</label>
          <input
            type="url"
            placeholder="https://..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !threshold}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-full text-sm font-medium transition-colors"
      >
        <Plus className="h-4 w-4" />
        {submitting ? "Creating…" : success ? "Created ✓" : "Create rule"}
      </button>
    </form>
  );
}

// ─── Rule Row ────────────────────────────────────────────────────

function RuleRow({
  rule,
  onDelete,
}: {
  rule: AlertRule;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting]   = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/alerts/rules?id=${rule.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDelete(rule.id);
    } catch {
      setDeleting(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!rule.webhookUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/alerts/rules/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: rule.webhookUrl, ruleId: rule.id }),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult(res.ok ? "✓ delivered" : `✗ ${data.error ?? res.status}`);
    } catch (err) {
      setTestResult(`✗ ${(err as Error).message}`);
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  const sevColor = { critical: "text-red-400", warning: "text-yellow-400", info: "text-blue-400" }[rule.severity];

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-900/60 border border-gray-800 rounded-xl text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold uppercase ${sevColor}`}>{rule.severity}</span>
          <span className="text-white font-medium">{rule.protocol}</span>
          <span className="text-gray-500 text-xs">{rule.condition} {rule.threshold}</span>
          {rule.webhookUrl && (
            <span className="text-xs text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-900/20">
              webhook
            </span>
          )}
        </div>
        {rule.lastTriggered && (
          <p className="text-xs text-gray-500 mt-0.5">
            Last fired: {timeAgo(new Date(rule.lastTriggered).getTime())}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {rule.webhookUrl && (
          <button
            onClick={handleTestWebhook}
            disabled={testing}
            title="Send test webhook"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-900/30 hover:bg-blue-800/50 border border-blue-500/20 rounded-full transition-colors disabled:opacity-50"
          >
            <Send className="h-3 w-3 text-blue-400" />
            {testing ? "…" : testResult ?? "Test"}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Disable rule"
          className="p-1.5 bg-red-900/20 hover:bg-red-800/40 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className={`h-3.5 w-3.5 text-red-400 ${deleting ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────

function RulesTab() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts/rules");
      if (!res.ok) return;
      const data: RulesResponse = await res.json();
      setRules(data.rules.filter((r) => r.enabled));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCreated = () => {
    fetchRules();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{rules.length} active rule{rules.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-500/20 rounded-full text-sm text-emerald-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "New rule"}
        </button>
      </div>

      {showForm && (
        <Card className="p-4 bg-gray-900/80 border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-4">Create alert rule</h3>
          <CreateRuleForm onCreated={handleCreated} />
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="line" className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card className="p-6 bg-gray-900/40 border-gray-800 text-center">
          <Settings2 className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No active rules — create one above</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function AlertsSection() {
  const [tab, setTab]                       = useState<"events" | "rules">("events");
  const [data, setData]                     = useState<AlertsResponse | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh]       = useState(true);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging]   = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
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
  }, []);

  const acknowledgeAlert = async (eventId: string) => {
    setAcknowledging(eventId);
    try {
      const res = await fetch("/api/alerts/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error(`Failed to acknowledge: ${res.status}`);
      setData((prev) =>
        prev ? { ...prev, alerts: prev.alerts.filter((a) => a.id !== eventId) } : null
      );
    } catch (err) {
      console.error("[Alerts] Acknowledge error:", err);
    } finally {
      setAcknowledging(null);
    }
  };

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAlerts, 120000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAlerts]);

  const activeAlerts    = data?.alerts.filter((a) => !a.acknowledged) ?? [];
  const criticalCount   = activeAlerts.filter((a) => a.severity === "critical").length;
  const warningCount    = activeAlerts.filter((a) => a.severity === "warning").length;
  const displayedAlerts = showAcknowledged ? data?.alerts ?? [] : activeAlerts;

  return (
    <section className="space-y-6" aria-labelledby="alerts-heading">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 id="alerts-heading" className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-yellow-400" />
            Alerts
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
          {tab === "events" && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-full p-1 w-fit">
        {(["events", "rules"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-full transition-colors capitalize ${
              tab === t
                ? "bg-emerald-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "events" ? `Events${activeAlerts.length > 0 ? ` (${activeAlerts.length})` : ""}` : "Rules"}
          </button>
        ))}
      </div>

      {/* Events tab */}
      {tab === "events" && (
        <>
          {error && (
            <Card className="p-6 bg-red-900/20 border-red-500/30">
              <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
              <p className="text-red-400">Could not check alerts</p>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
              <button onClick={fetchAlerts} className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm">
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
                const Icon   = config.icon;
                return (
                  <Card
                    key={alert.id}
                    className={`${config.bg} ${config.border} p-4 ${alert.acknowledged ? "opacity-50" : ""}`}
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
                          <Check className={`h-4 w-4 text-emerald-400 ${acknowledging === alert.id ? "animate-spin" : ""}`} />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Rules tab */}
      {tab === "rules" && <RulesTab />}
    </section>
  );
}
