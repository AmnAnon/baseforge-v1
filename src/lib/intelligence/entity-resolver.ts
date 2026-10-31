import { cache } from "@/lib/cache";

const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols";
const ENTITY_INDEX_TTL_MS = 5 * 60 * 1000;

export interface ProtocolSourceRecord {
  id?: string;
  slug?: string;
  name: string;
  category?: string;
  chains?: string[];
  chainTvls?: Record<string, number>;
  change_1d?: number;
  change_7d?: number;
  change_1m?: number;
  audits?: number;
  audit_links?: string[];
  oracles?: string[];
  forkedFrom?: string[];
  logo?: string;
  url?: string;
  apyMean30d?: number;
}

interface CachedProtocolIndex {
  records: ProtocolSourceRecord[];
  retrievedAt: number;
}

export interface ResolvedProtocolEntity {
  type: "protocol";
  id: string;
  slug: string;
  name: string;
  network: "base";
  category: string;
  chains: string[];
  logo: string | null;
  website: string | null;
  match: "canonical_id" | "slug" | "name";
  source: "defillama";
  sourceRetrievedAt: number;
  sourceRecord: ProtocolSourceRecord;
}

export type ProtocolResolution =
  | { status: "resolved"; entity: ResolvedProtocolEntity }
  | { status: "not_found"; query: string }
  | { status: "ambiguous"; query: string; candidates: Array<{ id: string; name: string; slug: string }> };

export function normalizeEntityKey(value: string): string {
  return value.toLowerCase().trim().replace(/^protocol:base:/, "").replace(/[^a-z0-9]/g, "");
}

export function canonicalProtocolId(slug: string): string {
  return `protocol:base:${slug}`;
}

function getBaseTvl(record: ProtocolSourceRecord): number {
  const tvls = record.chainTvls ?? {};
  return tvls.Base ?? tvls.base ?? tvls.BASE ?? 0;
}

async function getProtocolIndex(): Promise<CachedProtocolIndex> {
  return cache.getOrFetch("v1:entity-resolver:protocol-index", ENTITY_INDEX_TTL_MS, async () => {
    const response = await fetch(DEFILLAMA_PROTOCOLS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Protocol directory provider returned HTTP ${response.status}`);
    const records = await response.json() as ProtocolSourceRecord[];
    if (!Array.isArray(records)) throw new Error("Protocol directory provider returned an invalid payload");
    return {
      records: records.filter((record) => getBaseTvl(record) > 0),
      retrievedAt: Date.now(),
    };
  });
}

function toEntity(record: ProtocolSourceRecord, retrievedAt: number, match: ResolvedProtocolEntity["match"]): ResolvedProtocolEntity {
  const slug = record.slug || record.id || record.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    type: "protocol",
    id: canonicalProtocolId(slug),
    slug,
    name: record.name,
    network: "base",
    category: record.category || "Unknown",
    chains: record.chains?.length ? record.chains : ["Base"],
    logo: record.logo || null,
    website: record.url || null,
    match,
    source: "defillama",
    sourceRetrievedAt: retrievedAt,
    sourceRecord: record,
  };
}

/**
 * Resolves protocol names, slugs and canonical BaseForge IDs against the
 * provider-backed Base protocol directory. No fuzzy match is silently selected.
 */
export async function resolveProtocolEntity(query: string): Promise<ProtocolResolution> {
  const normalized = normalizeEntityKey(query);
  if (!normalized) return { status: "not_found", query };

  const { records, retrievedAt } = await getProtocolIndex();
  const exact: Array<{ record: ProtocolSourceRecord; match: "slug" | "name" }> = [];
  for (const record of records) {
    const slug = record.slug || record.id || record.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slugKey = normalizeEntityKey(slug);
    const nameKey = normalizeEntityKey(record.name);
    if (normalized === slugKey) exact.push({ record, match: "slug" });
    else if (normalized === nameKey) exact.push({ record, match: "name" });
  }

  if (exact.length === 1) {
    return { status: "resolved", entity: toEntity(exact[0].record, retrievedAt, exact[0].match) };
  }
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      query,
      candidates: exact.map(({ record }) => {
        const slug = record.slug || record.id || record.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return { id: canonicalProtocolId(slug), name: record.name, slug };
      }),
    };
  }

  const candidates = records
    .filter((record) => {
      const slug = record.slug || record.id || "";
      return normalizeEntityKey(record.name).includes(normalized) || normalizeEntityKey(slug).includes(normalized);
    })
    .slice(0, 5)
    .map((record) => {
      const slug = record.slug || record.id || record.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return { id: canonicalProtocolId(slug), name: record.name, slug };
    });

  if (candidates.length > 0) return { status: "ambiguous", query, candidates };
  return { status: "not_found", query };
}
