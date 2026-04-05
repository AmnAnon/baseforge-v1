// src/app/services/defillama.service.ts

const DEFILLAMA_BASE_URL = "https://api.llama.fi";
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Chain', 'Bridge']);

class DefiLlamaService {
  async getBaseProtocols() {
    try {
      const response = await fetch(`${DEFILLAMA_BASE_URL}/protocols`);
      if (!response.ok) throw new Error("Failed to fetch protocols");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allProtocols: any[] = await response.json();
      
      return allProtocols.filter(p => 
        p.chainTvls["Base"] && !EXCLUDED_CATEGORIES.has(p.category)
      );
    } catch (error) {
      console.error("DefiLlamaService getBaseProtocols Error:", error);
      return [];
    }
  }

  async getBaseTVLHistory() {
    try {
      const response = await fetch(`${DEFILLAMA_BASE_URL}/v2/historicalChainTvl/Base`);
      if (!response.ok) throw new Error("Failed to fetch TVL history");
      const data = await response.json();
      
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       return data.map((item: any) => ({
        date: new Date(item.date * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        "Total Value Locked": item.tvl,
      }));
    } catch (error) {
      console.error("DefiLlamaService getBaseTVLHistory Error:", error);
      return [];
    }
  }

  async getBaseYieldPools() {
    try {
      const response = await fetch(`https://yields.llama.fi/pools?chain=Base`);
      if (!response.ok) throw new Error('Failed to fetch yield pools');
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('DefiLlamaService getBaseYieldPools Error:', error);
      return [];
    }
  }
}

export const defiLlamaService = new DefiLlamaService();
