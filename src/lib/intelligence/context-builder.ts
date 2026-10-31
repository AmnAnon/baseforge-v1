import { getWhaleFlows } from "@/lib/data/indexers";
import { scoreLlamaProtocol } from "@/lib/risk";
import type { ResolvedProtocolEntity } from "./entity-resolver";

export type ProtocolContextSection = "overview" | "tvl" | "risk" | "whales";

function freshness(retrievedAt: number) {
  const ageSeconds = Math.max(0, Math.floor((Date.now() - retrievedAt) / 1000));
  return {
    observedAt: new Date(retrievedAt).toISOString(),
    ageSeconds,
    status: ageSeconds <= 300 ? "fresh" as const : "stale" as const,
  };
}

function getBaseTvl(entity: ResolvedProtocolEntity): number {
  const tvls = entity.sourceRecord.chainTvls ?? {};
  return tvls.Base ?? tvls.base ?? tvls.BASE ?? 0;
}

/**
 * Builds a protocol context bundle from existing BaseForge intelligence
 * primitives. This module assembles and labels data; it does not reimplement
 * provider ingestion or risk calculations.
 */
export async function buildProtocolContext(
  entity: ResolvedProtocolEntity,
  include: ProtocolContextSection[],
) {
  const record = entity.sourceRecord;
  const retrievedAt = entity.sourceRetrievedAt;
  const sourceFreshness = freshness(retrievedAt);
  const sections: Record<string, unknown> = {};

  if (include.includes("overview")) {
    sections.overview = {
      entity: {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        slug: entity.slug,
        network: entity.network,
        category: entity.category,
        chains: entity.chains,
        website: entity.website,
        logo: entity.logo,
      },
      provenance: { source: entity.source, ...sourceFreshness },
      quality: { status: "complete", classification: "provider_reported" },
    };
  }

  if (include.includes("tvl")) {
    sections.tvl = {
      value: getBaseTvl(entity),
      unit: "USD",
      change24hPct: record.change_1d ?? null,
      change7dPct: record.change_7d ?? null,
      change30dPct: record.change_1m ?? null,
      provenance: {
        source: "DefiLlama",
        methodology: "provider_reported_base_chain_tvl",
        ...sourceFreshness,
      },
      quality: {
        status: "complete",
        classification: "provider_reported",
        limitations: ["Provider valuation and chain attribution methodology apply."],
      },
    };
  }

  if (include.includes("risk")) {
    const risk = scoreLlamaProtocol({
      audits: record.audits ?? 0,
      change_1d: record.change_1d,
      change_7d: record.change_7d,
      category: record.category || "Other",
      oracles: record.oracles || [],
      forkedFrom: record.forkedFrom,
      apy: record.apyMean30d,
      chainTvls: record.chainTvls,
    });

    sections.risk = {
      healthScore: risk.health,
      riskScore: risk.risk,
      level: risk.level,
      auditStatus: risk.audit,
      factors: risk.riskFactors,
      methodology: "baseforge-risk-v1",
      provenance: {
        source: "BaseForge risk engine",
        inputSource: "DefiLlama",
        ...sourceFreshness,
      },
      quality: {
        status: "derived",
        classification: "heuristic",
        limitations: [
          "This is a heuristic indicator, not a security audit or probability of loss.",
          "Coverage depends on the availability and quality of provider metadata.",
        ],
      },
    };
  }

  if (include.includes("whales")) {
    const result = await getWhaleFlows({ protocol: entity.slug, minAmountUSD: 0, limit: 50 });
    const flows = result.flows.filter((flow) => flow.protocol.toLowerCase() === entity.slug.toLowerCase());
    sections.whales = {
      count: flows.length,
      flows,
      summary: {
        totalVolumeUSD: flows.reduce((sum, flow) => sum + flow.amountUSD, 0),
        largestFlowUSD: flows.length ? Math.max(...flows.map((flow) => flow.amountUSD)) : 0,
        netFlowUSD: flows.reduce((sum, flow) => {
          if (flow.type === "deposit" || flow.type === "liquidity_add") return sum + flow.amountUSD;
          if (flow.type === "withdraw" || flow.type === "liquidity_remove") return sum - flow.amountUSD;
          return sum;
        }, 0),
      },
      provenance: {
        source: result.source,
        observedAt: new Date(result.timestamp).toISOString(),
        ageSeconds: 0,
        status: result.source === "none" ? "unavailable" : "fresh",
      },
      quality: {
        status: result.source === "none" ? "unavailable" : "partial",
        classification: "indexed_events",
        limitations: ["Indexed event coverage depends on provider availability and supported protocol integrations."],
      },
    };
  }

  return {
    entity: {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      slug: entity.slug,
      network: entity.network,
    },
    sections,
    generatedAt: new Date().toISOString(),
  };
}
