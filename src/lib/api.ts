// src/lib/api.ts
export async function fetchProtocolOnBase(protocolSlug: string) {
  try {
    const response = await fetch(`https://api.llama.fi/protocol/${protocolSlug}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();

    const baseTvl = data.chainTvls?.Base?.tvl || data.tvl || 0;
    const baseFees = data.chainTvls?.Base?.fees || data.fees24h || 0;
    const baseVolume = data.chainTvls?.Base?.volume || 0;
    const apy = data.apyMean30d || 0;

    return {
      name: data.name,
      tvl: baseTvl,
      fees24h: baseFees,
      totalSupply: data.totalSupplyUsd || baseTvl,
      totalBorrow: data.borrowed || 0,
      volume24h: baseVolume,
      apy,
    };
  } catch (error) {
    console.error(`Failed to fetch protocol data for ${protocolSlug}:`, error);
    return { error: true, tvl: 0, fees24h: 0, totalSupply: 0, totalBorrow: 0, volume24h: 0, apy: 0 };
  }
}

export async function fetchHistoricalData(protocolSlug: string, days = 7) {
  try {
    const response = await fetch(`https://api.llama.fi/charts/${protocolSlug}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const chartData = await response.json();
    const recentData = chartData.slice(-days); // Last N days

    let tvlChange = 0, feesChange = 0, supplyChange = 0, borrowChange = 0;
    if (recentData.length >= 2) {
      const last = recentData[recentData.length - 1];
      const prev = recentData[recentData.length - 2];
      tvlChange = ((last.totalLiquidityUSD - prev.totalLiquidityUSD) / prev.totalLiquidityUSD) * 100 || 0;
      feesChange = ((last.fees - prev.fees) / prev.fees) * 100 || 0;
      supplyChange = tvlChange; // Proxy if no direct
      borrowChange = ((last.borrowed - prev.borrowed) / prev.borrowed) * 100 || 0;
    }

    return {
      historicalData: recentData.map((entry: { date: number; totalLiquidityUSD: number; fees?: number; totalSupplyUsd?: number; borrowed?: number }) => ({
        date: new Date(entry.date * 1000).toLocaleDateString(),
        tvl: entry.totalLiquidityUSD,
        fees: entry.fees || 0,
        supply: entry.totalSupplyUsd || entry.totalLiquidityUSD,
        borrow: entry.borrowed || 0,
      })),
      tvlChange,
      feesChange,
      supplyChange,
      borrowChange,
    };
  } catch (error) {
    console.error(`Failed to fetch historical data for ${protocolSlug}:`, error);
    return { historicalData: [], tvlChange: 0, feesChange: 0, supplyChange: 0, borrowChange: 0 };
  }
}

export async function fetchUSDCPeg() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd');
    const data = await response.json();
    const price = data['usd-coin']?.usd || 1;
    return { price, deviation: ((price - 1) * 100).toFixed(2) + '%' };
  } catch (error) {
    console.error('USDC peg fetch failed:', error);
    return { price: 1, deviation: '0%' };
  }
}
