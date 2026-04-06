// src/app/api/whales/route.ts
// Whale tracker — large Base chain transactions via Etherscan V2
import { NextResponse } from "next/server";
import { cache, CACHE_TTL } from "@/lib/cache";
import { rateLimiterMiddleware } from "@/lib/rate-limit";


const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_CHAIN_ID = 8453;
const ETH_PRICE_FALLBACK = 1800;

async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 300 } }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.ethereum?.usd || ETH_PRICE_FALLBACK;
    }
  } catch {}
  return ETH_PRICE_FALLBACK;
}

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  timestamp: string;
  type: "swap" | "transfer";
  tokenSymbol?: string;
}

function getLabel(address: string): string {
  const labels: Record<string, string> = {
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap V3 Router",
    "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4": "Aerodrome Router",
    "0x47536A12A465AC89E6Ad27884e2773dC1a5fA857": "Seamless",
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": "USDC",
  };
  const lower = address.toLowerCase();
  return labels[lower] || `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function GET(req: Request) {
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    const url = new URL(req.url);
    const minUSDParam = parseInt(url.searchParams.get("min") || "40000");
    const minUSD = Number.isFinite(minUSDParam) && minUSDParam >= 0 ? minUSDParam : 40000;

    const data = await cache.getOrFetch(`whales-data-${minUSD}`, CACHE_TTL.WHALE_TX, async () => {
      const monitoredAddresses = [
        { addr: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", label: "Uniswap V3" },
        { addr: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", label: "Aerodrome" },
        { addr: "0x47536A12A465AC89E6Ad27884e2773dC1a5fA857", label: "Seamless" },
      ];

      const whaleTransactions: WhaleTransaction[] = [];

      if (ETHERSCAN_API_KEY) {
        const ethPrice = await getEthPrice();
        const fetchPromises = monitoredAddresses.map(async ({ addr }) => {
          try {
            const etherscanUrl = `https://api.etherscan.io/v2/api?chainid=${BASE_CHAIN_ID}&module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
            const res = await fetch(etherscanUrl, { cache: "no-store" });
            const data = await res.json();

            if (data.status === "1" && data.result) {
              return data.result
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((tx: any) => {
                  const ethValue = parseFloat(tx.value) / 1e18;
                  return ethValue * ethPrice >= minUSD;
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((tx: any) => {
                  const ethValue = parseFloat(tx.value) / 1e18;
                  return {
                    hash: tx.hash,
                    from: getLabel(tx.from),
                    to: getLabel(tx.to),
                    value: `${ethValue.toFixed(2)} ETH`,
                    valueUSD: Math.round(ethValue * ethPrice),
                    timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
                    type: ethValue > 50 ? "swap" : "transfer",
                    tokenSymbol: "ETH",
                  } as WhaleTransaction;
                });
            }
            return [];
          } catch { return []; }
        });

        const results = await Promise.allSettled(fetchPromises);
        for (const result of results) {
          if (result.status === "fulfilled") {
            whaleTransactions.push(...result.value);
          }
        }
      }

      const uniqueTx = Array.from(
        new Map(whaleTransactions.map(tx => [tx.hash, tx])).values()
      ).sort((a, b) => b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0);

      return {
        whales: uniqueTx.slice(0, 50),
        summary: {
          total: uniqueTx.length,
          largest: uniqueTx.length > 0 ? uniqueTx[0].valueUSD : 0,
          avgSize: uniqueTx.length > 0
            ? Math.round(uniqueTx.reduce((sum, tx) => sum + tx.valueUSD, 0) / uniqueTx.length)
            : 0,
          types: uniqueTx.reduce((acc: Record<string, number>, tx) => {
            acc[tx.type] = (acc[tx.type] || 0) + 1;
            return acc;
          }, {}),
        },
        timestamp: Date.now(),
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Whale API error:", error);
    return NextResponse.json(
      { whales: [], summary: { total: 0, largest: 0, avgSize: 0, types: {} }, timestamp: Date.now() },
      { status: 200, headers: { "Cache-Control": "public, max-age=60" } }
    );
  }
}

export const dynamic = "force-dynamic";

export const revalidate = 60;
