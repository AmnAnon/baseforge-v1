// src/app/api/og/route.tsx
// Open Graph + Farcaster Frame image generator
// Generates 3:2 aspect ratio (1200×800) per Farcaster spec
// Also serves as OG image — Open Graph clients accept any dimensions
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface RawProtocol {
  name: string;
  chainTvls: Record<string, number>;
  change_1d?: number;
}

async function fetchTopProtocols(): Promise<{ name: string; tvl: number; change24h: number }[]> {
  try {
    const res = await fetch("https://api.llama.fi/protocols", { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const all = await res.json() as RawProtocol[];
    return all
      .filter(p => (p.chainTvls?.Base || 0) > 0)
      .sort((a, b) => (b.chainTvls.Base || 0) - (a.chainTvls.Base || 0))
      .slice(0, 5)
      .map(p => ({ name: p.name, tvl: p.chainTvls.Base || 0, change24h: p.change_1d || 0 }));
  } catch { return []; }
}

function fmt(t: number): string {
  if (t >= 1e9) return `$${(t / 1e9).toFixed(1)}B`;
  if (t >= 1e6) return `$${(t / 1e6).toFixed(0)}M`;
  return `$${(t / 1e3).toFixed(0)}K`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const protocol = searchParams.get("protocol");
    const all = await fetchTopProtocols();
    const metrics = protocol ? all.filter(m => m.name.toLowerCase().includes(protocol.toLowerCase())) : all;
    const top = metrics[0] || { name: "Base DeFi", tvl: 0, change24h: 0 };

    return new ImageResponse(
      (
        <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #000 0%, #0a0f1a 50%, #051015 100%)", fontFamily: '"SF Pro Display", "Inter", sans-serif', color: "#fff", padding: "60px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "40px" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "16px", background: "linear-gradient(135deg, #10b981, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: "bold" }}>BF</div>
            <div style={{ fontSize: "48px", fontWeight: "bold" }}>BaseForge Analytics</div>
          </div>
          <div style={{ fontSize: "64px", fontWeight: "800", background: "linear-gradient(to right, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "16px" }}>{fmt(top.tvl)}</div>
          <div style={{ fontSize: "28px", color: "#10b981", marginBottom: "8px" }}>{top.change24h >= 0 ? "▲" : "▼"} {Math.abs(top.change24h).toFixed(2)}% · 24h</div>
          <div style={{ fontSize: "32px", color: "#9ca3af", marginBottom: "30px" }}>{protocol || top.name}</div>
          {metrics.length > 1 && (
            <div style={{ display: "flex", gap: "40px" }}>
              {metrics.slice(1, 4).map(m => (
                <div key={m.name} style={{ textAlign: "center" }}>
                  <div style={{ color: "#6b7280", fontSize: "20px" }}>{m.name}</div>
                  <div style={{ color: m.change24h >= 0 ? "#10b981" : "#ef4444", fontSize: "24px", fontWeight: "600" }}>{fmt(m.tvl)} {m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ position: "absolute", bottom: "40px", fontSize: "20px", color: "#4b5563" }}>Real-time Base DeFi analytics</div>
        </div>
      ),
      { width: 1200, height: 800 }  // 3:2 ratio — Farcaster spec
    );
  } catch (error) {
    console.error("OG image error:", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
