export interface CoinGeckoPrice {
  [key: string]: {
    usd: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    usd_24h_change: number;
  };
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

/**
 * CoinGecko API Client
 * Free public API for cryptocurrency market data
 */
export class CoinGeckoService {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  
  /**
   * Get simple price data for multiple coins
   */
  async getSimplePrices(coinIds: string[]): Promise<CoinGeckoPrice> {
    try {
      const ids = coinIds.join(',');
      const response = await fetch(
        `${this.baseUrl}/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
      );
      if (!response.ok) throw new Error('Failed to fetch prices');
      return await response.json();
    } catch (error) {
      console.error('CoinGecko getSimplePrices error:', error);
      return {};
    }
  }

  /**
   * Get detailed coin data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getCoinData(coinId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (!response.ok) throw new Error(`Failed to fetch data for ${coinId}`);
      return await response.json();
    } catch (error) {
      console.error(`CoinGecko getCoinData error for ${coinId}:`, error);
      return null;
    }
  }

  /**
   * Get coins list with market data
   */
  async getCoinsMarkets(coinIds: string[]): Promise<CoinGeckoCoin[]> {
    try {
      const ids = coinIds.join(',');
      const response = await fetch(
        `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`
      );
      if (!response.ok) throw new Error('Failed to fetch coins markets');
      return await response.json();
    } catch (error) {
      console.error('CoinGecko getCoinsMarkets error:', error);
      return [];
    }
  }

  /**
   * Get coin logo URL
   */
  getCoinLogoUrl(coinId: string, size: 'thumb' | 'small' | 'large' = 'large'): string {
    // CoinGecko CDN URL pattern
    return `https://assets.coingecko.com/coins/images/${this.getCoinImageId(coinId)}/${size}/${coinId}.png`;
  }

  /**
   * Helper to map coin IDs to image IDs (approximate)
   */
  private getCoinImageId(coinId: string): number {
    // This is a simplified mapping - in production you'd fetch this from the API
    const knownMappings: Record<string, number> = {
      'morpho': 30581,
      'aave': 12645,
      'aerodrome-finance': 31745,
      'uniswap': 12504,
      'moonwell': 24450,
      'seamless-protocol': 33027,
      'baseswap': 30729,
      'compound-governance-token': 10775,
      'spark': 33037,
      'extra-finance': 29218
    };
    return knownMappings[coinId] || 0;
  }

  /**
   * Search for coins
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async searchCoins(query: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      return await response.json();
    } catch (error) {
      console.error('CoinGecko searchCoins error:', error);
      return { coins: [] };
    }
  }
}

export const coinGeckoService = new CoinGeckoService();
