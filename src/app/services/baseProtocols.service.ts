// src/app/services/baseProtocols.service.ts
import { defiLlamaService } from './defillama.service';

class BaseProtocolsService {
  async getDashboardAnalytics() {
    try {
const [protocols, tvlHistory, allYields] = await Promise.all([
        defiLlamaService.getBaseProtocols(),
        defiLlamaService.getBaseTVLHistory(),
         
        defiLlamaService.getBaseYieldPools()   // Fetches data for AVG APY
      ]);
      
      const topProtocols = protocols.slice(0, 10);

      const totalTvl = topProtocols.reduce((sum, p) => sum + (p.chainTvls.Base || 0), 0);
      const avgChange = topProtocols.reduce((sum, p) => sum + (p.change_1d || 0), 0) / topProtocols.length;
      
      // Calculate Average APY from the yield pools
      const avgApy = allYields.length > 0
        ? allYields.reduce((sum, pool) => sum + (pool.apy || 0), 0) / allYields.length
        : 0;

      const baseMetrics = {
        totalTvl,
        protocols: topProtocols.length,
        avgApy,
        change24h: avgChange,
      };

   const protocolDetails = topProtocols.map(p => ({
        id: p.slug,
        name: p.name,
        tvl: p.chainTvls.Base,
        }));

      return {
        baseMetrics,
        tvlHistory,
        protocols: protocolDetails,
      };

    } catch (error) {
      console.error('Error in BaseProtocolsService:', error);
      throw error;
    }
  }
}

export const baseProtocolsService = new BaseProtocolsService();
