// src/app/protocols/[slug]/opengraph-image.tsx
// OG image for protocol detail pages.
// Rendered by @vercel/og at build/request time.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BaseForge Protocol Analytics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ProtocolData {
  name: string;
  category: string;
  tvl: number;
  healthScore: number;
  tvlChange24h: number;
  logo?: string;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 65) return "#60a5fa";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  let protocol: ProtocolData | null = null;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/protocols/${slug}`);
    if (res.ok) {
      const data = await res.json();
      protocol = data.protocol ?? null;
    }
  } catch { /* use fallback */ }

  const name        = protocol?.name        ?? slug;
  const category    = protocol?.category    ?? "DeFi";
  const tvl         = protocol?.tvl         ?? 0;
  const healthScore = protocol?.healthScore ?? 0;
  const change24h   = protocol?.tvlChange24h ?? 0;
  const color       = scoreColor(healthScore);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "radial-gradient(ellipse at 30% 40%, #0d1f0d 0%, #0a0a0a 60%)",
          padding: "60px",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "auto" }}>
          <div style={{
            background: "#10b981",
            borderRadius: "8px",
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
          }}>⬡</div>
          <span style={{ fontSize: "20px", color: "#10b981", fontWeight: 600 }}>BaseForge Analytics</span>
        </div>

        {/* Protocol name + category */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {protocol?.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={protocol.logo}
                width={64}
                height={64}
                style={{ borderRadius: "50%", border: "2px solid #1f2937" }}
                alt={name}
              />
            )}
            <span style={{ fontSize: "64px", fontWeight: 700, letterSpacing: "-2px" }}>{name}</span>
          </div>
          <span style={{
            fontSize: "22px",
            background: "#1f2937",
            color: "#9ca3af",
            padding: "6px 16px",
            borderRadius: "999px",
            alignSelf: "flex-start",
          }}>{category} · Base</span>
        </div>

        {/* Metrics row */}
        <div style={{ display: "flex", gap: "24px" }}>
          {/* TVL */}
          <div style={{
            flex: 1,
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "16px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <span style={{ fontSize: "16px", color: "#6b7280" }}>Total Value Locked</span>
            <span style={{ fontSize: "42px", fontWeight: 700, color: "#10b981" }}>{fmt(tvl)}</span>
            <span style={{ fontSize: "16px", color: change24h >= 0 ? "#10b981" : "#f87171" }}>
              {change24h >= 0 ? "▲" : "▼"} {Math.abs(change24h).toFixed(1)}% (24h)
            </span>
          </div>

          {/* Health Score */}
          <div style={{
            flex: 1,
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "16px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <span style={{ fontSize: "16px", color: "#6b7280" }}>Health Score</span>
            <span style={{ fontSize: "42px", fontWeight: 700, color }}>{healthScore}<span style={{ fontSize: "22px", color: "#6b7280" }}>/100</span></span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, background: "#1f2937", borderRadius: "9999px", height: "8px" }}>
                <div style={{ width: `${healthScore}%`, background: color, borderRadius: "9999px", height: "8px" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
