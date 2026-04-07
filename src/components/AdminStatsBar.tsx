// src/components/AdminStatsBar.tsx
// Collapsible admin stats bar for Farcaster frame analytics.

"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, BarChart3, Users, MousePointerClick, Eye, Loader2 } from "lucide-react";

interface AnalyticsData {
  totalInteractions: number;
  uniqueUsers: number;
  clicksPerTab: Record<string, number>;
  topProtocols: { protocol: string; views: number }[];
}

const POLL_INTERVAL = 30_000; // 30s

// Hardcoded admin FID — match the server-side value
const ADMIN_FID = 666666;

export default function AdminStatsBar() {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?adminFid=${ADMIN_FID}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
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

  const totalTabClicks = data
    ? Object.values(data.clicksPerTab).reduce((s, v) => s + v, 0)
    : 0;

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
              p-3 text-xs font-mono"
          >
            {/* Summary row */}
            <div className="flex gap-4 mb-3 text-gray-300">
              <Stat icon={MousePointerClick} label="Total Clicks" value={data?.totalInteractions ?? 0} />
              <Stat icon={Users} label="Unique FIDs" value={data?.uniqueUsers ?? 0} />
              <Stat icon={Eye} label="Tab Clicks" value={totalTabClicks} />
            </div>

            {loading && !data && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={12} className="animate-spin" />
                Loading frame analytics…
              </div>
            )}

            {!loading && !data && (
              <div className="text-gray-500">No data — connect your DB and ensure ADMIN_FID env var is set.</div>
            )}

            {/* Clicks per tab */}
            {data && Object.keys(data.clicksPerTab).length > 0 && (
              <>
                <h4 className="text-emerald-400 text-[10px] uppercase tracking-wider mb-1">Clicks per Tab</h4>
                <div className="flex gap-4 mb-3">
                  {Object.entries(data.clicksPerTab).map(([tab, count]) => (
                    <span key={tab} className="text-gray-300">
                      {tab}: <span className="text-white font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Top protocols */}
            {data && data.topProtocols.length > 0 && (
              <>
                <h4 className="text-emerald-400 text-[10px] uppercase tracking-wider mb-1">Top Protocols</h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-300">
                  {data.topProtocols.map(p => (
                    <span key={p.protocol}>
                      {p.protocol}: <span className="text-white font-bold">{p.views}</span>
                    </span>
                  ))}
                </div>
              </>
            )}

            {data && data.topProtocols.length === 0 && Object.keys(data.clicksPerTab).length === 0 && (
              <div className="text-gray-500">0 interactions recorded so far.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
