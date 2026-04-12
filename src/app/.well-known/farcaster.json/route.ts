// src/app/.well-known/farcaster.json/route.ts
// Dynamic farcaster.json — resolves base URL at runtime instead of
// serving broken ${...} template literals from a static file.

import { NextResponse } from "next/server";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET() {
  const base = getBaseUrl();

  const manifest = {
    accountAssociation: {
      header: process.env.FC_ACCOUNT_HEADER || "",
      payload: process.env.FC_ACCOUNT_PAYLOAD || "",
      signature: process.env.FC_ACCOUNT_SIGNATURE || "",
    },
    miniapp: {
      version: "1",
      name: "BaseForge Analytics",
      iconUrl: `${base}/icon.png`,
      homeUrl: base,
      imageUrl: `${base}/api/og`,
      buttonTitle: "Launch Dashboard",
      splashImageUrl: `${base}/splash.png`,
      splashBackgroundColor: "#0a0a0a",
      webhookUrl: `${base}/api/webhook`,
      subtitle: "Base DeFi Analytics",
      description:
        "Real-time DeFi analytics for the Base blockchain. Track TVL, protocol health, whale movements, market data and risk scores.",
      primaryCategory: "finance",
      tags: ["defi", "base", "analytics", "tvl", "protocols"],
      heroImageUrl: `${base}/api/og`,
      tagline: "Real-time Base DeFi analytics",
      ogTitle: "BaseForge Analytics",
      ogDescription: "Comprehensive Base chain DeFi dashboard",
      ogImageUrl: `${base}/api/og`,
      noindex: false,
      requiredChains: ["eip155:8453"],
    },
    frame: {
      version: "1",
      name: "BaseForge Analytics",
      iconUrl: `${base}/icon.png`,
      homeUrl: base,
      imageUrl: `${base}/api/og`,
      buttonTitle: "Launch Dashboard",
      splashImageUrl: `${base}/splash.png`,
      splashBackgroundColor: "#0a0a0a",
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const dynamic = "force-dynamic";
