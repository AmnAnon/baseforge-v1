// src/app/api/og/agent/route.tsx
// OG image for the AI agent context endpoint — shared when people
// link to /api/agents/context on Twitter/Farcaster/Discord.
import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET() {
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
          background: "linear-gradient(135deg, #000 0%, #0a0a2e 40%, #0a1628 70%, #06120d 100%)",
          fontFamily: "Inter, sans-serif",
          padding: "60px",
        }}
      >
        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            AI
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, color: "#fff" }}>
            BaseForge Agent API
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#8b5cf6", marginBottom: 44, fontWeight: 600 }}>
          AI-Ready Intelligence Layer for Base DeFi
        </div>

        {/* Feature cards */}
        <div style={{ display: "flex", gap: 24, marginBottom: 44 }}>
          {[
            { label: "Protocols", value: "500+", color: "#10b981" },
            { label: "Risk Scoring", value: "Real-time", color: "#3b82f6" },
            { label: "Whale Flows", value: "Live", color: "#f59e0b" },
            { label: "Intent Signals", value: "AI-detected", color: "#8b5cf6" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "16px 24px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 14,
                border: `1px solid ${item.color}33`,
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Code snippet hint */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 28px",
            background: "rgba(139,92,246,0.1)",
            borderRadius: 12,
            border: "1px solid rgba(139,92,246,0.3)",
          }}
        >
          <div style={{ fontSize: 16, color: "#c4b5fd", fontFamily: "monospace" }}>
            GET /api/agents/context?include=all
          </div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>→ JSON for Claude / GPT / o1</div>
        </div>

        <div style={{ position: "absolute", bottom: 40, fontSize: 16, color: "#4b5563" }}>
          baseforge.xyz · Open Source
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
