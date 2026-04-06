// src/app/api/social/route.ts
// Social signals — Farcaster cast volume per protocol
// Uses public Farcaster data via Neynar API (free tier)
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

interface SocialSignal {
  protocol: string;
  casts: number;
  uniqueUsers: number;
  positiveCasts: number;
  neutralCasts: number;
  negativeCasts: number;
  trendingScore: number; // 0-100
  lastCast: string;
}

// Protocol → search keywords for cast matching
const PROTOCOL_KEYWORDS: Record<string, string[]> = {
  "aerodrome": ["aerodrome", "aero token", "$aero"],
  "moonwell": ["moonwell", "$well"],
  "sonne finance": ["sonne", "$sonne"],
  "seamless protocol": ["seamless", "seamless protocol"],
  "compound v3": ["compound", "$comp"],
  "aave": ["aave", "$aave"],
  "uniswap": ["uniswap", "$uni"],
  "baseswap": ["baseswap"],
  "extra finance": ["extra finance", "extrafi"],
  "pendle": ["pendle", "$pendle"],
};

function simpleSentiment(text: string): "positive" | "negative" | "neutral" {
  const positive = ["bull", "moon", "bullish", "great", "love", "amazing", "pump", "up", "gains", "yield"];
  const negative = ["rug", "scam", "bear", "dump", "down", "loss", "hack", "exploit", "bad", "slow"];

  const lower = text.toLowerCase();
  let pos = 0;
  let neg = 0;

  for (const word of positive) {
    if (lower.includes(word)) pos++;
  }
  for (const word of negative) {
    if (lower.includes(word)) neg++;
  }

  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("social-signals", CACHE_TTL.WHALE_TX, async () => {
      // Neynar API requires API key — check for it
      const neynarApiKey = process.env.NEYNAR_API_KEY;

      const signals: SocialSignal[] = [];

      if (!neynarApiKey) {
        // Return empty signals with a flag showing API key needed
        for (const protocol of Object.keys(PROTOCOL_KEYWORDS)) {
          signals.push({
            protocol,
            casts: 0,
            uniqueUsers: 0,
            positiveCasts: 0,
            neutralCasts: 0,
            negativeCasts: 0,
            trendingScore: 0,
            lastCast: "Neynar API key required",
          });
        }

        return { signals, needsApiKey: true, timestamp: Date.now() };
      }

      // Fetch casts from Farcaster via Neynar
      for (const [protocol, keywords] of Object.entries(PROTOCOL_KEYWORDS)) {
        const searchQuery = keywords[0]; // main keyword

        try {
          const res = await fetch(
            `https://api.neynar.com/v2/farcaster/feed/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
            {
              headers: {
                api_key: neynarApiKey,
                "Content-Type": "application/json",
              },
              cache: "no-store",
            }
          );

          if (res.ok) {
            const json = await res.json();
            const casts = json.result?.casts || [];
            const uniqueUsers = new Set(casts.map((c: { author?: { fid?: string } }) => c.author?.fid)).size;

            const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
            for (const cast of casts) {
              const text = cast.text || "";
              const sentiment = simpleSentiment(text);
              sentimentCounts[sentiment]++;
            }

            signals.push({
              protocol,
              casts: casts.length,
              uniqueUsers,
              positiveCasts: sentimentCounts.positive,
              neutralCasts: sentimentCounts.neutral,
              negativeCasts: sentimentCounts.negative,
              trendingScore: Math.min(100, Math.round((casts.length * uniqueUsers) / 2)),
              lastCast: casts.length > 0 ? "Just now" : "N/A",
            });
          }
        } catch {
          signals.push({
            protocol,
            casts: 0,
            uniqueUsers: 0,
            positiveCasts: 0,
            neutralCasts: 0,
            negativeCasts: 0,
            trendingScore: 0,
            lastCast: "Fetch failed",
          });
        }
      }

      return {
        signals: signals.sort((a, b) => b.trendingScore - a.trendingScore),
        needsApiKey: false,
        timestamp: Date.now(),
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("Social API error:", err);
    return NextResponse.json({ error: "Social data unavailable" }, { status: 500 });
  }
}
