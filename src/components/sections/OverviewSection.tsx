// src/components/sections/OverviewSection.tsx
"use client";


import { useState, useMemo } from "react";
import { formatCurrency, formatPercentage, freshnessColor, timeAgo, dataConfidence } from "@/lib/utils";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  InfoIcon,
  BarChart3,
  Wallet,
  TrendingUp,
  DollarSign,
  Coins,
  LineChart,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { NeonCard } from "@/components/ui/NeonCard";
import BaseNetworkMetrics from "./BaseNetworkMetrics";
import BaseTVLChart from "@/components/charts/BaseTVLChart";
import ProtocolSwitcher, { Protocol } from "../ui/ProtocolSwitcher";
import { MetricSkeleton } from "@/components/ui/Skeleton";
import { useProtocolDetail } from "@/hooks/useSWRData";

interface MetricCardProps {
  title: string;
  value: number | null;
  change: number | null;
  isLoading: boolean;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tooltipText?: string;
  format?: "currency" | "percentage";
  valuePrefix?: string;
  valueSuffix?: string;
  actionLabel?: string;
  actionUrl?: string;
  glowColor?: string;
  /** When true, renders "N/A" instead of "—" and hides the change row entirely */
  notApplicable?: boolean;
}

// Deep link map for protocols
const PROTOCOL_LINKS: Record<string, { label: string; url: string }> = {
  "aerodrome-finance": { label: "Swap on Aerodrome", url: "https://aerodrome.finance/swap" },
  "aerodrome": { label: "Swap on Aerodrome", url: "https://aerodrome.finance/swap" },
  "moonwell": { label: "Lend on Moonwell", url: "https://moonwell.fi/markets/Base" },
  "sonne-finance": { label: "Lend on Sonne", url: "https://sonne.finance" },
  "seamless-protocol": { label: "Deposit on Seamless", url: "https://app.seamlessprotocol.com" },
  "seamless": { label: "Deposit on Seamless", url: "https://app.seamlessprotocol.com" },
  "compound-v3": { label: "Supply on Compound", url: "https://app.compound.finance" },
  "aave-v3": { label: "Supply on Aave", url: "https://app.aave.com" },
  "uniswap-v3": { label: "Swap on Uniswap", url: "https://app.uniswap.org" },
  "baseswap": { label: "Swap on BaseSwap", url: "https://baseswap.fi" },
};

function getProtocolAction(protocolName: string): { label: string; url: string } | null {
  const key = protocolName.toLowerCase().replace(/ /g, "-");
  if (PROTOCOL_LINKS[key]) return PROTOCOL_LINKS[key];
  // Try partial match
  for (const [name, action] of Object.entries(PROTOCOL_LINKS)) {
    if (protocolName.toLowerCase().includes(name.split("-")[0])) return action;
  }
  return null;
}

interface OverviewSectionProps {
  data: {
    baseMetrics?: {
      totalTvl: number;
      totalProtocols: number;
      avgApy: number;
      change24h: number;
    };
    tvlHistory?: { date: string; tvl: number }[];
    protocols?: { id: string; name: string; tvl: number; logo?: string; change24h?: number }[];
    protocolData?: {
      [key: string]: {
        tvl?: number;
        tvlChange?: number;
        totalBorrow?: number;
        feesAnnualized?: number;
        revenueAnnualized?: number;
        tokenPrice?: number | null;
        utilization?: number;
      };
    };
    timestamp?: number;
    _dataSource?: string;
    _confidence?: string;
  } | null;
  isLoading: boolean;
}

const MetricCard = ({
  title,
  value,
  change,
  isLoading,
  icon: Icon,
  tooltipText,
  format = "currency",
  valuePrefix = "",
  valueSuffix = "",
  actionLabel,
  actionUrl,
  notApplicable = false,
}: MetricCardProps) => {
  const isPositive = change !== null && change > 0;
  const hasChange = change !== null && change !== 0;

  const changeColor =
    change === null || change === 0
      ? "text-gray-400"
      : isPositive
      ? "text-emerald-400"
      : "text-red-400";

  const formatValue = (val: number | null) => {
    if (notApplicable) return "N/A";
    if (val === null) return "—";
    if (format === "percentage") return `${val.toFixed(2)}%`;
    return formatCurrency(val);
  };

  return (
    <NeonCard className="relative !bg-gradient-to-br !from-gray-900/95 !via-gray-800/90 !to-black/95 border-0 p-5 rounded-2xl shadow-2xl hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 group overflow-hidden before:absolute before:inset-0 before:rounded-2xl before:p-[2px] before:bg-gradient-to-br before:from-emerald-500/40 before:via-transparent before:to-emerald-500/20 before:-z-10 hover:before:from-emerald-500/60 hover:before:to-emerald-500/40 h-full">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-auto">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-3">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 group-hover:text-emerald-400 transition-colors">
                {title}
              </h3>
              {tooltipText && (
                <div className="relative group/tooltip">
                  <button
                    type="button"
                    className="focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full"
                    aria-label={`More information about ${title}`}
                    title={tooltipText}
                  >
                    <InfoIcon className="h-3.5 w-3.5 text-gray-500 hover:text-emerald-400 transition-colors" aria-hidden={true} />
                  </button>
                  <div className="absolute left-0 top-6 w-48 p-2 bg-gray-950 border border-emerald-500/30 rounded-lg text-xs text-gray-300 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-10 pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    {tooltipText}
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-950 border-l border-t border-emerald-500/30 transform rotate-45"></div>
                  </div>
                </div>
              )}
            </div>

            <div>
              {isLoading ? (
                <MetricSkeleton />
              ) : (
                <>
                  <p className="text-xl sm:text-2xl font-bold text-white mb-1.5 truncate group-hover:text-emerald-50 transition-colors" title={value !== null ? formatValue(value) : undefined}>
                    {valuePrefix}
                    {formatValue(value)}
                    {valueSuffix}
                  </p>

                  {hasChange && (
                    <div className={`flex items-center text-xs sm:text-sm font-medium ${changeColor}`}>
                      {isPositive ? (
                        <ArrowUpIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" aria-hidden={true} />
                      ) : (
                        <ArrowDownIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" aria-hidden={true} />
                      )}
                      <span>
                        {formatPercentage(Math.abs(change!))}
                        <span className="text-gray-500 ml-1">24h</span>
                      </span>
                    </div>
                  )}

                  {/* Intentionally no fallback text — "—" in value is sufficient */}
                </>
              )}
            </div>
          </div>

          {Icon && (
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-emerald-900/40 to-gray-800/40 rounded-xl group-hover:from-emerald-800/60 group-hover:to-emerald-900/60 transition-all duration-300 flex-shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <Icon className="h-5 w-5 text-emerald-400 group-hover:text-emerald-300 transition-colors drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" aria-hidden={true} />
            </div>
          )}
        </div>

        {/* Action link */}
        {actionUrl && actionLabel && (
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1 text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors font-medium"
          >
            {actionLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </NeonCard>
  );
};

export default function OverviewSection({ data, isLoading }: OverviewSectionProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol>(
    data?.protocols?.[0] || {
      id: "seamless-protocol",
      name: "Seamless Protocol",
      logo: "https://coin-images.coingecko.com/coins/images/33480/large/Seamless_Logo_Black_Transparent.png",
      tvl: 0,
    }
  );

  // Fetch per-protocol detail (fees, token price, utilization) from the detail endpoint
  const { data: detailResponse, isLoading: detailLoading } =
    useProtocolDetail(selectedProtocol?.id ?? null);

  // Merge: detail endpoint wins over analytics protocolData fallback
  const analyticsData = data?.protocolData?.[selectedProtocol.id] || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detail: any = (detailResponse as any)?.protocol ?? {};

  const protocolData = {
    tvl:              detail.tvl              ?? analyticsData.tvl             ?? null,
    tvlChange:        detail.tvlChange24h     ?? analyticsData.tvlChange       ?? null,
    totalBorrow:      detail.totalBorrow      ?? analyticsData.totalBorrow     ?? null,
    feesAnnualized:   detail.feesAnnualized   ?? analyticsData.feesAnnualized  ?? null,
    revenueAnnualized:detail.revenueAnnualized?? analyticsData.revenueAnnualized?? null,
    tokenPrice:       detail.tokenPrice       ?? analyticsData.tokenPrice      ?? null,
    utilization:      detail.utilization      ?? analyticsData.utilization     ?? null,
    category:         detail.category         ?? null,
  };

  const isLendingProtocol = ["seamless-protocol", "moonwell", "aave-v3", "compound-v3", "sonne-finance"]
    .some(s => selectedProtocol.id?.includes(s));

  const cardLoading = isLoading || detailLoading;

  const protocolAction = useMemo(
    () => getProtocolAction(selectedProtocol.name),
    [selectedProtocol.name]
  );

  const confidence = useMemo(() =>
    data
      ? dataConfidence({
          source: (data as Record<string, unknown>)._dataSource as string ?? "defillama",
          ageMs: data.timestamp ? Date.now() - data.timestamp : Infinity,
          isStale: false,
        })
      : "low",
    [data]
  );

  return (
    <section className="space-y-6" aria-labelledby="overview-heading">
      {/* Header */}
      <div className="space-y-2">
        <h2 id="overview-heading" className="text-2xl sm:text-3xl font-bold text-white">
          Base Network Overview
        </h2>
        <p className="text-sm sm:text-base text-gray-400">
          Real-time DeFi metrics across Base blockchain
        </p>
        {data?.timestamp && (
          <div className={`text-xs ${freshnessColor(data.timestamp)}`}>
            Updated {timeAgo(data.timestamp)}
          </div>
        )}
      </div>

      {/* Data health banner */}
      {!isLoading && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
          confidence === "high"
            ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400"
            : confidence === "medium"
            ? "bg-yellow-900/20 border-yellow-500/30 text-yellow-400"
            : "bg-red-900/20 border-red-500/30 text-red-400"
        }`}>
          {confidence === "high"
            ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            : confidence === "medium"
            ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            : <XCircle className="h-3.5 w-3.5 flex-shrink-0" />}
          <span>
            {confidence === "high"
              ? "Data live — sourced from DefiLlama (TVL methodology aligned)"
              : confidence === "medium"
              ? "Serving cached data — DefiLlama may be slow"
              : "Data unavailable — showing last known values"}
          </span>
          <span className="ml-auto text-gray-500">
            Source: {(data as Record<string, unknown> | null)?._dataSource as string ?? "defillama"}
          </span>
        </div>
      )}

      {/* Base Network Metrics */}
      <BaseNetworkMetrics data={data?.baseMetrics ? {
        ...data.baseMetrics,
        _source: (data as Record<string, unknown>)._dataSource as string | undefined,
        _updatedAt: data.timestamp,
      } : null} isLoading={isLoading} />

      {/* Base TVL Chart */}
        <BaseTVLChart />

      {/* Protocol Selector */}
      <div className="space-y-3">
        <h3 className="text-lg sm:text-xl font-bold text-white">Protocol Details</h3>
        <ProtocolSwitcher
          protocols={data?.protocols || []}
          selectedProtocol={selectedProtocol}
          onProtocolChange={setSelectedProtocol}
          isLoading={isLoading}
        />
      </div>

      {/* Protocol Metrics Grid */}
      <div
        className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 auto-rows-fr"
        role="list"
        aria-label="Protocol metrics"
      >
        <div role="listitem">
          <MetricCard
            title="Total Value Locked"
            value={protocolData.tvl}
            change={protocolData.tvlChange}
            isLoading={cardLoading}
            icon={BarChart3}
            tooltipText="Total capital deposited in the protocol"
            actionLabel={protocolAction?.label}
            actionUrl={protocolAction?.url}
          />
        </div>

        <div role="listitem">
          <MetricCard
            title="Total Borrowed"
            value={protocolData.totalBorrow}
            change={null}
            isLoading={cardLoading}
            icon={Wallet}
            tooltipText="Total amount borrowed from the protocol"
            notApplicable={!isLendingProtocol}
          />
        </div>

        <div role="listitem">
          <MetricCard
            title="Fees (Annualized)"
            value={protocolData.feesAnnualized}
            change={null}
            isLoading={cardLoading}
            icon={TrendingUp}
            tooltipText="Estimated yearly fees generated"
          />
        </div>

        <div role="listitem">
          <MetricCard
            title="Revenue (Annualized)"
            value={protocolData.revenueAnnualized}
            change={null}
            isLoading={cardLoading}
            icon={DollarSign}
            tooltipText="Estimated yearly revenue"
          />
        </div>

        <div role="listitem">
          <MetricCard
            title="Token Price"
            value={protocolData.tokenPrice}
            change={null}
            isLoading={cardLoading}
            icon={Coins}
            tooltipText="Live token price"
          />
        </div>

        <div role="listitem">
          <MetricCard
            title="Utilization Rate"
            value={protocolData.utilization}
            change={null}
            isLoading={cardLoading}
            icon={LineChart}
            tooltipText="Percentage of supply currently borrowed"
            format="percentage"
            notApplicable={!isLendingProtocol}
          />
        </div>
      </div>
    </section>
  );
}
