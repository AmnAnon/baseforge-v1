// src/components/AdminStatsBar.tsx
// Collapsible admin stats bar for Farcaster frame analytics.
// Authenticates via x-admin-key header (matches ADMIN_KEY env var).

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  BarChart3,
  Users,
  MousePointerClick,
  Eye,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface ButtonStat {
  buttonIndex: number;
  label: string;
  clicks: number;
}

interface DAUDay {
  date: string;
  dau: number;
  interactions: number;
}

interface AnalyticsData {
  totalInteractions: number;
  uniqueUsers: number;
  clicksPerButton: ButtonStat[];
  dauTrend: DAUDay[];
  clicksPerTab: Record<string, number>;
  topProtocols: { protocol: string; views: number }[];
}

const POLL_INTERVAL = 30_000; // 30s

// Admin key — must match ADMIN_KEY env var on the server
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

export default function AdminStatsBar() {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics", {
        headers: { "x-admin-key": ADMIN_KEY },
      });
      if (!res.ok) {
        setData(null);
        if (res.status === 403) setError("Forbidden — check ADMIN_KEY");
        else setError(`API error: ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    fetchAnalytics();
    const timer = setInterval(fetchAnalytics, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [expanded, fetchAnalytics]);

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-14 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-screen-xl mx-auto px-2 pointer-events-auto">
        {/* Toggle pill */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 mx-auto px-3 py-1 text-xs font-mono
            bg-black/80 backdrop-blur border border-emerald-500/30 rounded-t-lg
            text-emerald-400 hover:text-emerald-300 hover:border-emerald-400/50
            transition-colors"
        >
          <BarChart3 size={12} />
          <span>Admin Frame Stats</span>
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>

        {/* Expanded panel */}
        {expanded && (
          <div
            className="bg-black/95 backdrop-blur-md border border-emerald-500/20
              rounded-b-lg rounded-tr shadow-[0_-5px_30px_rgba(16,185,129,0.1)]
              p-3 text-xs font-mono max-h-[50vh] overflow-y-auto"
          >
            {/* Summary row */}
            <div className="flex gap-4 mb-3 text-gray-300">
              <Stat
                icon={MousePointerClick}
                label="Total Clicks"
                value={data?.totalInteractions ?? 0}
              />
              <Stat icon={Users} label="Unique FIDs" value={data?.uniqueUsers ?? 0} />
              <Stat
                icon={Eye}
                label="Tab Clicks"
                value={
                  data
                    ? Object.values(data.clicksPerTab).reduce((s, v) => s + v, 0)
                    : 0
                }
              />
            </div>

            {/* Error state */}
            {error && (
              <div className="text-red-400 mb-2">{error}</div>
            )}

            {loading && !data && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={12} className="animate-spin" />
                Loading frame analytics…
              </div>
            )}

            {!loading && !data && !error && (
              <div className="text-gray-500">
                No data — set ADMIN_KEY env var and restart.
              </div>
            )}

            {/* Clicks per Button table */}
            {data && data.clicksPerButton.length > 0 && (
              <Section title="Interaction Volume — Clicks per Button">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="pr-3 pb-1">Button</th>
                      <th className="pr-3 pb-1">Index</th>
                      <th className="pb-1 text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clicksPerButton.map((b) => (
                      <tr key={b.buttonIndex} className="border-b border-gray-800/50">
                        <td className="py-0.5 pr-3 text-gray-300">{b.label}</td>
                        <td className="py-0.5 pr-3 text-gray-500">{b.buttonIndex}</td>
                        <td className="py-0.5 text-right text-white font-bold">
                          {b.clicks.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* DAU Trend */}
            {data && data.dauTrend.length > 0 && (
              <Section title="Daily Active Users (Last 7 Days)">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {data.dauTrend.map((d) => (
                    <div
                      key={d.date}
                      className="flex-shrink-0 bg-gray-900/50 border border-gray-800 rounded px-2 py-1.5 text-center min-w-[80px]"
                    >
                      <div className="text-[10px] text-gray-500">
                        {formatDate(d.date)}
                      </div>
                      <div className="text-sm text-white font-bold">{d.dau}</div>
                      <div className="text-[10px] text-gray-500">
                        {d.interactions} clicks
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Clicks per Tab */}
            {data && Object.keys(data.clicksPerTab).length > 0 && (
              <Section title="Clicks per Tab">
                <div className="flex gap-4">
                  {Object.entries(data.clicksPerTab).map(([tab, count]) => (
                    <span key={tab} className="text-gray-300">
                      {tab}:{" "}
                      <span className="text-white font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Top Protocols */}
            {data && data.topProtocols.length > 0 && (
              <Section title="Top Protocols">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-300">
                  {data.topProtocols.map((p) => (
                    <span key={p.protocol}>
                      {p.protocol}:{" "}
                      <span className="text-white font-bold">{p.views}</span>
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Empty state */}
            {data &&
              data.topProtocols.length === 0 &&
              Object.keys(data.clicksPerTab).length === 0 &&
              data.totalInteractions === 0 && (
                <div className="text-gray-500">
                  0 interactions recorded so far.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <Icon size={12} className="text-emerald-400" />
      <span className="text-gray-500">{label}:</span>
      <span className="text-white font-bold">{value.toLocaleString()}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="text-emerald-400 text-[10px] uppercase tracking-wider mb-1">
        {title}
      </h4>
      {children}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}