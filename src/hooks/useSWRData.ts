// src/hooks/useSWRData.ts
// SWR hooks for every API route — replaces bare useEffect fetch in page.tsx.
// Provides stale-while-revalidate, auto-refocus, deduplication.

import useSWR, { SWRConfiguration } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
};

// Base hook
export function useApiData<T>(key: string, config?: SWRConfiguration) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
    keepPreviousData: true,
    ...config,
  });
}

// Convenience hooks
export function useAnalytics(config?: SWRConfiguration) {
  return useApiData("/api/analytics", config);
}

export function usePrices(config?: SWRConfiguration) {
  return useApiData("/api/prices", config);
}

export function useGasPrices(config?: SWRConfiguration) {
  return useApiData("/api/gas", { refreshInterval: 30_000, ...config });
}

export function useWhales(config?: SWRConfiguration) {
  return useApiData("/api/whales", { refreshInterval: 60_000, ...config });
}

export function useRiskMetrics(config?: SWRConfiguration) {
  return useApiData("/api/risk", config);
}

export function useRevenue(config?: SWRConfiguration) {
  return useApiData("/api/revenue", config);
}

export function useMEV(config?: SWRConfiguration) {
  return useApiData("/api/mev", config);
}
