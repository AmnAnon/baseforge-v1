import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const data = await cache.getOrFetch("prices", CACHE_TTL.PRICES, async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd&include_24hr_change=true",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
      return await res.json();
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Price API error:", err);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 502 });
  }
}
