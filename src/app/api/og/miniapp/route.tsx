// src/app/api/og/miniapp/route.tsx
// Farcaster Mini App embed image — 3:2 aspect ratio (1200×800)
// Spec: Must be 3:2 ratio, max 1024 chars for the image URL
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function fmt(t: number): string {
  if (t >= 1e9) return `$${(t / 1e9).toFixed(1)}B`;
  if (t >= 1e6) return `$${(t / 1e6).toFixed(0)}M`;
  return `$${(t / 1e3).toFixed(0)}K`;
}

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #000 0%, #0a0f1a 50%, #051015 100%)", fontFamily: '"SF Pro Display", "Inter", sans-serif', color: "#fff", padding: "60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "40px" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "16px", background: "linear-gradient(135deg, #10b981, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: "bold" }}>BF</div>
          <div style={{ fontSize: "48px", fontWeight: "bold" }}>BaseForge Analytics</div>
        </div>
        <div style={{ fontSize: "64px", fontWeight: "800", background: "linear-gradient(to right, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "16px" }}>Real-time Base DeFi</div>
        <div style={{ fontSize: "28px", color: "#10b981", marginBottom: "40px" }}>TVL · Protocols · Whales · Risks</div>
        <div style={{ display: "flex", gap: "30px" }}>
          <div style={{ textAlign: "center", padding: "20px 30px", background: "rgba(16,185,129,0.1)", borderRadius: "16px" }}>
            <div style={{ fontSize: "20px", color: "#6b7280", marginBottom: "8px" }}>Total Protocols</div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#10b981" }}>10</div>
          </div>
          <div style={{ textAlign: "center", padding: "20px 30px", background: "rgba(59,130,246,0.1)", borderRadius: "16px" }}>
            <div style={{ fontSize: "20px", color: "#6b7280", marginBottom: "8px" }}>Live Data</div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#3b82f6" }}>30s</div>
          </div>
          <div style={{ textAlign: "center", padding: "20px 30px", background: "rgba(245,158,11,0.1)", borderRadius: "16px" }}>
            <div style={{ fontSize: "20px", color: "#6b7280", marginBottom: "8px" }}>Health Score</div>
            <div style={{ fontSize: "36px", fontWeight: "bold", color: "#f59e0b" }}>A+</div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: "40px", fontSize: "20px", color: "#4b5563" }}>basforge.xyz</div>
      </div>
    ),
    { width: 1200, height: 800 }  // 3:2 ratio — Farcaster spec
  );
}
