import { defiLlamaService } from './defillama.service';

// Case-insensitive Base TVL lookup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBaseTvl(p: any): number {
  return p.chainTvls?.['Base'] ?? p.chainTvls?.['base'] ?? p.chainTvls?.['BASE'] ?? 0;
}

class BaseProtocolsService {
  async getDashboardAnalytics() {
    try {
      const [protocols, tvlHistory, allYields] = await Promise.all([
        defiLlamaService.getBaseProtocols(),
        defiLlamaService.getBaseTVLHistory(),
        defiLlamaService.getBaseYieldPools()
      ]);

      const topProtocols = protocols.slice(0, 20);

      const totalTvl = topProtocols.reduce((sum: number, p: unknown) => sum + getBaseTvl(p), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const avgChange = topProtocols.reduce((sum: number, p: any) => sum + (p.change_1d || 0), 0) / (topProtocols.length || 1);

      const avgApy = allYields.length > 0
        ? allYields.reduce((sum: number, pool: { apy?: number }) => sum + (pool.apy || 0), 0) / allYields.length
        : 0;

      const baseMetrics = {
        totalTvl,
        protocols: topProtocols.length,
        avgApy,
        change24h: avgChange,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const protocolDetails = topProtocols.map((p: any) => ({
        id: p.slug,
        name: p.name,
        tvl: getBaseTvl(p),
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
