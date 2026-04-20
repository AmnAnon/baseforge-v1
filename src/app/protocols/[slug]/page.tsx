// src/app/protocols/[slug]/page.tsx
// Async Server Component — fetches data at request time (or build time for static params).

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProtocolDetailClient } from "./ProtocolDetailClient";

interface ProtocolData {
  id: string;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  logo?: string;
  tvl: number;
  tvlChange24h: number;
  tvlChange7d: number;
  tvlChange30d?: number;
  fees24h: number;
  feesAnnualized: number;
  revenue24h: number;
  apy?: number;
  dominanceScore: number;
  healthScore: number;
  riskScore: number;
  audits: number;
  auditLink?: string;
  auditStatus: string;
  oracles: string[];
  forkedFrom?: string[];
  riskFactors: string[];
  warning: string | null;
}

interface RiskPoint {
  date: string;
  healthScore: number;
  tvl: number;
  timestamp: number;
}

interface WhaleEvent {
  txHash: string;
  action: string;
  usdValue: number;
  wallet: string;
  netFlowDirection: string;
  timestamp: number;
}

interface DetailResponse {
  protocol: ProtocolData;
  tvlHistory: { date: string; tvl: number }[];
  riskHistory: RiskPoint[];
  whaleActivity: WhaleEvent[];
  timestamp: number;
}

async function fetchProtocol(slug: string): Promise<DetailResponse | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/protocols/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── generateStaticParams — pre-render top 20 Base protocols ──

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const res = await fetch("https://api.llama.fi/protocols", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const all: unknown[] = await res.json();

    const EXCLUDED = new Set(["CEX", "Chain"]);

    type LlamaProtocol = {
      slug?: string;
      id?: string;
      chains?: string[];
      category?: string;
      chainTvls?: Record<string, number>;
    };

    const getBase = (p: LlamaProtocol) => p.chainTvls?.Base ?? p.chainTvls?.base ?? 0;

    return (all as LlamaProtocol[])
      .filter((p) => p.chains?.includes("Base") && !EXCLUDED.has(p.category ?? ""))
      .sort((a, b) => getBase(b) - getBase(a))
      .slice(0, 20)
      .map((p) => ({ slug: p.slug ?? p.id ?? "" }))
      .filter((p) => p.slug !== "");
  } catch {
    return [];
  }
}

// ─── Metadata ─────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchProtocol(slug);
  if (!data?.protocol) {
    return { title: "Protocol Not Found — BaseForge" };
  }
  const p = data.protocol;
  const tvlStr = p.tvl >= 1e9
    ? `$${(p.tvl / 1e9).toFixed(2)}B`
    : p.tvl >= 1e6
    ? `$${(p.tvl / 1e6).toFixed(1)}M`
    : `$${p.tvl.toLocaleString()}`;

  return {
    title: `${p.name} — BaseForge Analytics`,
    description: `${p.name} on Base: TVL ${tvlStr}, health score ${p.healthScore}/100. ${p.category} protocol analytics powered by BaseForge.`,
    openGraph: {
      title: `${p.name} — BaseForge`,
      description: `TVL: ${tvlStr} · Health: ${p.healthScore}/100 · ${p.category}`,
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────

export default async function ProtocolDetailPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await fetchProtocol(slug);
  if (!data?.protocol) notFound();
  return <ProtocolDetailClient data={data} />;
}

export const dynamic = "force-dynamic";
