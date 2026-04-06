// src/app/api/wallet-labels/route.ts
// Wallet label system — community-sourced wallet labels stored client-side
// This API provides a shared dataset when Upstash is configured.
// Labels are user-generated — "smart money" is just a label, not verified truth.
import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface WalletLabel {
  address: string;
  label: string;
  category: "smart_money" | "whale" | "bot" | "market_maker" | "protocol" | "team" | "community" | "other";
  confidence: "verified" | "unverified";
  source: string; // who labeled it
  createdAt: number;
}

// Shared community labels
// In production, these come from a persistent store.
// For now, seeded with known protocol wallets.
const COMMUNITY_LABELS: WalletLabel[] = [
  {
    address: "0x04d6115703b0128899b820f6e21862b2b1913e92",
    label: "Aerodrome: Router",
    category: "protocol",
    confidence: "verified",
    source: "defiyields",
    createdAt: Date.now(),
  },
  {
    address: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
    label: "Uniswap V3: Router",
    category: "protocol",
    confidence: "verified",
    source: "defiyields",
    createdAt: Date.now(),
  },
  {
    address: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    label: "Aerodrome: V2 Router",
    category: "protocol",
    confidence: "verified",
    source: "defiyields",
    createdAt: Date.now(),
  },
  {
    address: "0x47536a12a465ac89e6ad2773dc1a5fa857",
    label: "Seamless Protocol",
    category: "protocol",
    confidence: "verified",
    source: "defiyields",
    createdAt: Date.now(),
  },
];

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const address = url.searchParams.get("address");

    const labels = await cache.getOrFetch("wallet-labels", 600_000, async () => {
      if (address) {
        return COMMUNITY_LABELS.filter(
          (l) => l.address.toLowerCase() === address.toLowerCase()
        );
      }
      return COMMUNITY_LABELS;
    });

    return NextResponse.json({ labels, timestamp: Date.now() });
  } catch (err) {
    console.error("Wallet labels API error:", err);
    return NextResponse.json({ labels: [], timestamp: Date.now() });
  }
}
