// src/app/api/og/signal/route.tsx
// Dynamic Open Graph image for whale signals and copy-trade alpha.
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function formatUSD(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || "ETH";
    const amount = Number(searchParams.get("amount")) || 50000;
    const signal = searchParams.get("type") || "ACCUMULATION";
    const winRate = searchParams.get("winRate") || "85.3";
    const protocol = searchParams.get("protocol") || "Aerodrome";
    const wallet = searchParams.get("wallet") || "0x7a25...48a1";

    const isGem = signal === "GEM_SNIPE";
    const signalColor = isGem ? "#a855f7" : "#10b981";
    const signalText = isGem ? "💎 GEM SNIPE" : "📈 ACCUMULATION";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #05070e 0%, #0a1128 50%, #000000 100%)",
            fontFamily: "Inter, sans-serif",
            color: "#ffffff",
            padding: "48px 56px",
            border: "2px solid rgba(0, 212, 255, 0.2)",
          }}
        >
          {/* Top Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #00d4ff, #7b61ff)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#000000",
                }}
              >
                BF
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#ffffff" }}>BaseForge</span>
                <span style={{ fontSize: 13, color: "#00d4ff", fontFamily: "monospace" }}>Whale Alpha Alert</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {winRate}% Win-Rate Whale
            </div>
          </div>

          {/* Main Content Box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(0, 0, 0, 0.6)",
              borderRadius: 24,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "32px 40px",
              boxShadow: "0 0 40px rgba(0, 212, 255, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  color: signalColor,
                  background: `${signalColor}20`,
                  border: `1px solid ${signalColor}40`,
                  padding: "4px 12px",
                  borderRadius: 8,
                }}
              >
                {signalText}
              </span>
              <span style={{ fontSize: 16, color: "#9ca3af" }}>via {protocol} on Base</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: 64, fontWeight: 900, color: "#ffffff" }}>
                ${token}
              </span>
              <span style={{ fontSize: 40, fontWeight: 700, color: "#00d4ff", fontFamily: "monospace" }}>
                {formatUSD(amount)}
              </span>
            </div>

            <div style={{ fontSize: 16, color: "#6b7280", marginTop: 8, fontFamily: "monospace" }}>
              Wallet: {wallet}
            </div>
          </div>

          {/* Footer Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 16 }}>
              <span>⚡ 1-Click Copy-Trade on Base</span>
            </div>
            <div style={{ fontSize: 16, color: "#00d4ff", fontWeight: 700 }}>
              baseforge-v1.vercel.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    return new ImageResponse(
      (
        <div style={{ height: "100%", width: "100%", background: "#0a0a0a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          BaseForge Whale Alpha
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
