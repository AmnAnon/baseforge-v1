export const BASEFORGE_DEFAULT_URL = "https://baseforge-v1.vercel.app";
export const BASEFORGE_API_VERSION = "1.0.0";

export type ContextSection = "overview" | "tvl" | "risk" | "whales";

export interface BaseForgeClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ApiResponseMeta {
  apiVersion: string;
  generatedAt: string;
  requestId: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiResponseMeta;
}

export interface ProtocolContextQuery {
  entity: {
    type: "protocol";
    id?: string;
    name?: string;
    network?: "base";
  };
  include?: ContextSection[];
}

export interface ProtocolContext {
  entity: {
    id: string;
    type: "protocol";
    name: string;
    slug: string;
    network: "base";
  };
  sections: Partial<Record<ContextSection, unknown>>;
  generatedAt: string;
  resolution: {
    strategy: "canonical_id" | "slug" | "name";
    canonicalId: string;
  };
}

export interface ApiCapability {
  id: string;
  name: string;
  description: string;
  operations: Array<{
    id: string;
    method: "GET" | "POST";
    path: string;
    description: string;
    auth: "public" | "optional_api_key" | "api_key";
    dataDomains: string[];
  }>;
}

export class BaseForgeApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "BaseForgeApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BaseForgeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: BaseForgeClientOptions = {}) {
    this.baseUrl = (options.baseUrl || BASEFORGE_DEFAULT_URL).replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetcher = options.fetch ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (this.apiKey) headers.set("X-API-Key", this.apiKey);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(this.timeoutMs),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error = payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { code?: string; message?: string } }).error
        : undefined;
      throw new BaseForgeApiError(
        error?.message || `BaseForge API returned HTTP ${response.status}`,
        response.status,
        error?.code,
        payload,
      );
    }

    return payload as T;
  }

  getCapabilities(): Promise<ApiEnvelope<{ capabilities: ApiCapability[]; operationCount: number; conventions: Record<string, string> }>> {
    return this.request("/api/v1/capabilities");
  }

  getCatalog(): Promise<ApiEnvelope<{ networks: unknown[]; datasets: unknown[]; discovery: Record<string, string> }>> {
    return this.request("/api/v1/catalog");
  }

  getMetricDefinitions(): Promise<ApiEnvelope<{ metrics: unknown[]; count: number; interpretationRules: string[] }>> {
    return this.request("/api/v1/metrics");
  }

  getUsage(): Promise<ApiEnvelope<Record<string, unknown>>> {\n    return this.request("/api/v1/usage");\n  }\n\n  getProtocolContext(query: ProtocolContextQuery): Promise<ApiEnvelope<ProtocolContext>> {
    if (!query.entity.id && !query.entity.name) {
      throw new TypeError("Provide entity.id or entity.name.");
    }
    return this.request("/api/v1/context/query", {
      method: "POST",
      body: JSON.stringify({
        ...query,
        entity: { ...query.entity, network: query.entity.network ?? "base" },
        include: query.include ?? ["overview", "tvl", "risk"],
      }),
    });
  }
}

export function createBaseForgeClient(options?: BaseForgeClientOptions): BaseForgeClient {
  return new BaseForgeClient(options);
}
