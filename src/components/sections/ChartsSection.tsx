"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, DollarSign, AlertCircle } from "lucide-react";

interface ChartsData {
  tvlData: { date: string; tvl: number }[];
  feesData: { date: string; fees: number }[];
  revenueData: { date: string; revenue: number }[];
  supplyBorrowData: { date: string; supply: number; borrow: number }[];
}

export default function ChartsSection({
  data,
  protocol,
  isLoading: parentLoading,
}: {
  data?: ChartsData | null;
  protocol?: string;
  isLoading?: boolean;
}) {
  const [chartsData, setChartsData] = useState<ChartsData | null>(data || null);
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChartsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/charts${protocol ? `?protocol=${protocol}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        setChartsData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChartsData();
  }, [protocol]);

  if (isLoading || parentLoading) {
    return (
      <div className="space-y-8">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-gray-900/60 border-gray-800 p-6">
            <div className="h-7 bg-gray-800 rounded animate-pulse mb-4 w-48" />
            <div className="h-[300px] bg-gray-800/50 rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-400 font-medium">Failed to load chart data</p>
        <p className="text-gray-500 text-sm mt-1">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const d = chartsData;
  if (!d) return <p className="text-gray-500">No chart data available.</p>;

  return (
    <div className="space-y-8">
      {/* TVL Trend */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Total Value Locked (TVL)
          </h2>
          <p className="text-xs text-gray-500 mb-4">30-day trend</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={d.tvlData}>
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                }}
              />
              <Area type="monotone" dataKey="tvl" stroke="#10b981" strokeWidth={2} fill="url(#tvlGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fees */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-400" />
            Daily Protocol Fees
          </h2>
          <p className="text-xs text-gray-500 mb-4">30-day fee generation</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={d.feesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                }}
              />
              <Bar dataKey="fees" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supply vs Borrow */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-1">Supply vs Borrow</h2>
          <p className="text-xs text-gray-500 mb-4">30-day liquidity dynamics</p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={d.supplyBorrowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip
                formatter={(value: number, key: string) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                }}
              />
              <Area
                type="monotone"
                dataKey="supply"
                stroke="#22c55e"
                strokeWidth={2}
                fill="rgba(34, 197, 94, 0.1)"
                name="Supply"
              />
              <Line
                type="monotone"
                dataKey="borrow"
                stroke="#ef4444"
                strokeWidth={2}
                name="Borrow"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
