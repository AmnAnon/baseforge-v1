// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

// Local testing via frames.js debugger
// Change to ngrok or Vercel URL on deploy
const BASE_URL = "http://localhost:3000";

export const metadata: Metadata = {
  title: "BaseForge Analytics — Real-time Base DeFi Dashboard",
  description: "Comprehensive analytics for the Base blockchain ecosystem. Track TVL, protocol health, whale movements, market data and risk scores.",
  openGraph: {
    title: "BaseForge Analytics",
    description: "Real-time DeFi analytics on Base chain",
    images: [
      {
        url: `${BASE_URL}/api/og`,
        width: 1200,
        height: 800,
        alt: "BaseForge Analytics — Base DeFi Dashboard",
      },
    ],
    type: "website",
    url: BASE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "BaseForge Analytics",
    description: "Real-time DeFi analytics on Base chain",
    images: [`${BASE_URL}/api/og`],
  },
  // Farcaster Frame V1 metadata — flattened OpenGraph properties
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${BASE_URL}/api/og`,
    "fc:frame:image:aspect_ratio": "1.91:1",
    "fc:frame:button:1": "Launch Dashboard",
    "fc:frame:post_url": `${BASE_URL}/api/frame`,
  },
};

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
