// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";

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
    title: "BaseForge Analytics — Real-time Base DeFi Dashboard",
    description: "Comprehensive analytics for the Base blockchain ecosystem. Track TVL, protocol health, whale movements, market data and risk scores.",
    openGraph: {
      title: "BaseForge Analytics",
      description: "Real-time DeFi analytics on Base chain",
      images: [
        {
          url: `${baseUrl}/api/og`,
          width: 1200,
          height: 630,
          alt: "BaseForge Analytics — Base DeFi Dashboard",
        },
      ],
      type: "website",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: "BaseForge Analytics",
      description: "Real-time DeFi analytics on Base chain",
      images: [`${baseUrl}/api/og`],
    },
    // Farcaster Frame V1 metadata — embedded as OpenGraph other tags
    other: {
      "fc:frame": "vNext",
      "fc:frame:image": `${baseUrl}/api/og`,
      "fc:frame:image:aspect_ratio": "1.91:1",
      "fc:frame:button:1": "Launch Dashboard",
      "fc:frame:button:2": "↻ Refresh",
      "fc:frame:post_url": `${baseUrl}/api/frame`,
      "fc:frame:input:text": "Search protocols...",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
