import { defiLlamaService } from './defillama.service';

class BaseProtocolsService {
  async getDashboardAnalytics() {
    try {
      const [protocols, tvlHistory, allYields] = await Promise.all([
        defiLlamaService.getBaseProtocols(),
        defiLlamaService.getBaseTVLHistory(),
        defiLlamaService.getBaseYieldPools()
      ]);

      const topProtocols = protocols.slice(0, 20);

      const totalTvl = topProtocols.reduce((sum: number, p: { chainTvls: Record<string, number> }) => sum + (p.chainTvls.Base || 0), 0);
      const avgChange = topProtocols.reduce((sum: number, p: { change_1d?: number }) => sum + (p.change_1d || 0), 0) / topProtocols.length;

      const avgApy = allYields.length > 0
        ? allYields.reduce((sum: number, pool: { apy?: number }) => sum + (pool.apy || 0), 0) / allYields.length
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
