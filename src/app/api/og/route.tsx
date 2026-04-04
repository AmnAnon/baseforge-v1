// src/app/api/og/route.tsx
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #000 0%, #0a1628 50%, #06120d 100%)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, background: "linear-gradient(to right, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16 }}>
            BaseForge Analytics
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#9ca3af", marginBottom: 50 }}>
            Real-time DeFi analytics on Base chain
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: 50 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#10b981" }}>500+</div>
              <div style={{ display: "flex", fontSize: 18, color: "#6b7280" }}>Protocols</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#3b82f6" }}>Live</div>
              <div style={{ display: "flex", fontSize: 18, color: "#6b7280" }}>TVL Data</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#f59e0b" }}>24/7</div>
              <div style={{ display: "flex", fontSize: 18, color: "#6b7280" }}>Monitoring</div>
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
    console.error("OG error:", err);
    return new Response("Failed", { status: 500 });
  }
}
