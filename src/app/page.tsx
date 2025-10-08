// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, CandlestickChart, Fish, ShieldAlert, BarChart3 } from 'lucide-react';
import OverviewSection from "@/components/sections/OverviewSection";
import MarketSection from "@/components/sections/MarketSection";
import WhalesSection from "@/components/sections/WhalesSection";
import RiskSection from "@/components/sections/RiskSection";
import ChartsSection from "@/components/sections/ChartsSection";

interface AnalyticsData {
  tvl: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  markets: any[];
  feesAnnualized: number;
  revenueAnnualized: number;
  seamPrice: number;
  seamFdv: number;
}

export default function Home() {
  const [tab, setTab] = useState("overview");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
     try {
      const response = await fetch('/api/analytics');
      if (!response.ok) throw new Error('API failed to fetch data');
      const data = await response.json();
      setAnalytics(data);
    } catch (err: any) {
      setError('Failed to load analytics.');
      console.error(err);
    } finally {
      setIsLoading(false); // Only set loading to false after the first load
    }
  };

  useEffect(() => {
    loadData(); 
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval); 
  }, []);

  const renderSection = () => {
    if (error && !analytics) return <p className="text-red-400">{error}</p>;
    switch (tab) {
      case "market": return <MarketSection data={analytics} isLoading={isLoading} />;
      case "whales": return <WhalesSection />;
      case "risk": return <RiskSection data={analytics} isLoading={isLoading} />;
      case "charts": return <ChartsSection data={analytics} isLoading={isLoading} />;
      default: return <OverviewSection data={analytics} isLoading={isLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white pb-20">
      <div className="p-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 text-transparent bg-clip-text break-words">
          Seamless Protocol Dashboard
        </h1>
        <p className="text-gray-400 mb-6">Real-time DeFi analytics on Base</p>
        {renderSection()}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-gray-800 flex justify-around py-3">
        <button onClick={() => setTab("overview")} className={`${tab === "overview" ? "text-purple-400" : "text-gray-400"} flex flex-col items-center gap-1`}>
          <LayoutDashboard size={20} />
          <span className="text-xs">Overview</span>
        </button>
        <button onClick={() => setTab("market")} className={`${tab === "market" ? "text-purple-400" : "text-gray-400"} flex flex-col items-center gap-1`}>
          <CandlestickChart size={20} />
          <span className="text-xs">Market</span>
        </button>
        <button onClick={() => setTab("whales")} className={`${tab === "whales" ? "text-purple-400" : "text-gray-400"} flex flex-col items-center gap-1`}>
          <Fish size={20} />
          <span className="text-xs">Whales</span>
        </button>
        <button onClick={() => setTab("risk")} className={`${tab === "risk" ? "text-purple-400" : "text-gray-400"} flex flex-col items-center gap-1`}>
          <ShieldAlert size={20} />
          <span className="text-xs">Risk</span>
        </button>
        <button onClick={() => setTab("charts")} className={`${tab === "charts" ? "text-purple-400" : "text-gray-400"} flex flex-col items-center gap-1`}>
          <BarChart3 size={20} />
          <span className="text-xs">Charts</span>
        </button>
      </div>
    </div>
  );
}
