// src/app/layout.tsx
import "./globals.css";
import "@coinbase/onchainkit/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import DemoBanner from "@/components/DemoBanner";
import OnchainKitAppProvider from "@/components/providers/OnchainKitAppProvider";

const inter = Inter({ subsets: ["latin"] });

const FALLBACK_URL = "http://localhost:3000";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return FALLBACK_URL;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();

  return {
    title: "BaseForge — AI-Ready Intelligence Layer for Base",
    description:
      "Real-time Base DeFi intelligence: protocol risk, whale flows, MEV, and compressed context for AI agents via /api/agents/context.",
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      title: "BaseForge — Intelligence Layer for Base",
      description: "Live ecosystem state, risk scoring, and agent-ready API for Base DeFi",
      images: [
        {
          url: `${baseUrl}/api/og`,
          width: 1200,
          height: 630,
          alt: "BaseForge — AI-Ready Intelligence Layer for Base",
        },
      ],
      type: "website",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: "BaseForge — Intelligence Layer for Base",
      description: "Live ecosystem state, risk scoring, and agent-ready API for Base DeFi",
      images: [`${baseUrl}/api/og`],
    },
    // Farcaster Frame V1 metadata — embedded as OpenGraph other tags
    other: {
      "fc:frame": "v3",
      "fc:frame:image": `${baseUrl}/api/og`,
      "fc:frame:image:aspect_ratio": "1.91:1",
      "fc:frame:button:1": "Launch Dashboard",
      "fc:frame:button:2": "↻ Refresh",
      "fc:frame:post_url": `${baseUrl}/api/frame`,
      "fc:frame:input:text": "Search protocols...",
      // Base.dev domain verification
      "base:app_id": "69db4cc2ed56423f0cd3e634",
      // Talent App project ownership verification
      "talentapp:project_verification":
        "81e7387631632dfca99033dd4c71becfc509a4dc6d2da73271aef9793f3dd61e4ba7ab14ffe2117d916d8ce80d11c545186555cb7e4694bedbf6cf73d84e32a9",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Preview / explicit demo only — never on production (VERCEL_URL is set on all Vercel deploys).
  const showDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.VERCEL_ENV === "preview";

  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0a0a0a] text-[#e0e0e0] min-h-screen`}>
        <OnchainKitAppProvider>
          {showDemo && <DemoBanner />}
          <div id="scanlines" className="scanlines" />
          {children}
        </OnchainKitAppProvider>
      </body>
    </html>
  );
}
