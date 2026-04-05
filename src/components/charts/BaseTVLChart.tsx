'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface TVLDataPoint {
  date: number;
  formattedDate: string;
  tvl: number;
}

const formatNumber = (num: number) => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
};

const TIMEFRAMES = ['3M', '6M', '1Y', 'All'] as const;
type Timeframe = typeof TIMEFRAMES[number];

export default function BaseTVLChart() {
  const [allData, setAllData] = useState<TVLDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('All');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('https://api.llama.fi/v2/historicalChainTvl/base');
        const json = await res.json();

        if (!Array.isArray(json)) {
          console.error('Unexpected API response:', json);
          setAllData([]);
          return;
        }

        const formatted = json
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((d: any) => d.tvl > 0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((d: any) => ({
            date: d.date * 1000,
            formattedDate: new Date(d.date * 1000).toLocaleDateString('en-US', {
              month: 'short',
              year: '2-digit',
            }),
            tvl: d.tvl,
          }));

        setAllData(formatted);
      } catch (err) {
        console.error('Error fetching TVL data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

   const filteredData = useMemo(() => {
    if (timeframe === 'All') return allData;
    const now = new Date().getTime();
    let startDate = now;

    switch (timeframe) {
      case '3M':
        startDate = new Date().setMonth(new Date().getMonth() - 3);
        break;
      case '6M':
        startDate = new Date().setMonth(new Date().getMonth() - 6);
        break;
      case '1Y':
        startDate = new Date().setFullYear(new Date().getFullYear() - 1);
        break;
    }

    return allData.filter((d) => d.date >= startDate);
  }, [allData, timeframe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-[420px] bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700 shadow-lg overflow-hidden">
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-30 blur-3xl"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        style={{ backgroundSize: '200% 200%' }}
      />

      <div className="relative z-10 flex flex-col h-full">
        <h2 className="text-lg font-bold text-white mb-3">Base Network TVL (USD)</h2>

        {/* Timeframe Buttons */}
        <div className="flex space-x-2 mb-4 bg-slate-800/40 p-2 rounded-lg w-fit">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 ${
                timeframe === t
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Chart Section */}
        <div className="flex-1 relative mt-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={timeframe} 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={filteredData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="neonGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f5ff" stopOpacity={1} />
                      <stop offset="100%" stopColor="#5b21b6" stopOpacity={0.2} />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tickFormatter={(val) => formatNumber(val)}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => `$${formatNumber(value as number)}`}
                    labelStyle={{ color: '#22d3ee' }}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      color: '#fff'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tvl"
                    stroke="url(#neonGlow)"
                    strokeWidth={3}
                    dot={false}
                    filter="url(#glow)"
                    activeDot={{
                      r: 6,
                      fill: '#00f5ff',
                      stroke: '#0ea5e9',
                      strokeWidth: 2
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
