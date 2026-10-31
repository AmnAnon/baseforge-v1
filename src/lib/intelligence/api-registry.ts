/**
 * BaseForge public API registry.
 *
 * Keep this registry as the single source of truth for discovery metadata.
 * Runtime handlers, docs, and agent adapters should reference these IDs rather
 * than maintaining independent capability lists.
 */

export const API_VERSION = "1.0.0";
export const API_BASE_PATH = "/api/v1";

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

export const CAPABILITIES: ApiCapability[] = [
  {
    id: "protocol_intelligence",
    name: "Protocol intelligence",
    description: "Discover Base protocols and retrieve protocol-level analytics and risk context.",
    operations: [
      { id: "list_protocols", method: "GET", path: "/api/protocols", description: "List Base protocols ranked by reported TVL.", auth: "public", dataDomains: ["protocols", "tvl"] },
      { id: "get_protocol", method: "GET", path: "/api/protocols/{slug}", description: "Retrieve a protocol profile, TVL, risk indicators and available history.", auth: "public", dataDomains: ["protocols", "tvl", "risk"] },
      { id: "get_risk", method: "GET", path: "/api/risk", description: "Retrieve Base protocol risk scores and aggregate risk indicators.", auth: "public", dataDomains: ["risk"] },
    ],
  },
  {
    id: "market_intelligence",
    name: "Market intelligence",
    description: "Access token market data, charts, fees, revenue and Base network gas metrics.",
    operations: [
      { id: "get_market", method: "GET", path: "/api/market", description: "Retrieve token market snapshots.", auth: "public", dataDomains: ["market"] },
      { id: "get_charts", method: "GET", path: "/api/charts", description: "Retrieve available ecosystem time series.", auth: "public", dataDomains: ["historical_data"] },
      { id: "get_revenue", method: "GET", path: "/api/revenue", description: "Retrieve protocol fee and revenue estimates.", auth: "public", dataDomains: ["fees", "revenue"] },
      { id: "get_gas", method: "GET", path: "/api/gas", description: "Retrieve Base gas metrics.", auth: "public", dataDomains: ["network"] },
    ],
  },
  {
    id: "onchain_activity",
    name: "On-chain activity",
    description: "Access indexed swap, lending and large-wallet activity.",
    operations: [
      { id: "get_whales", method: "GET", path: "/api/whales", description: "Retrieve large-wallet flows detected by supported indexers.", auth: "public", dataDomains: ["whales", "transactions"] },
      { id: "get_swaps", method: "GET", path: "/api/swaps", description: "Retrieve indexed DEX swap events.", auth: "public", dataDomains: ["swaps", "transactions"] },
      { id: "get_lending", method: "GET", path: "/api/lending", description: "Retrieve supported lending activity events.", auth: "public", dataDomains: ["lending", "transactions"] },
    ],
  },
  {
    id: "agent_context",
    name: "Agent context",
    description: "Retrieve compressed, multi-domain context assembled for AI agents.",
    operations: [
      { id: "get_agent_context", method: "GET", path: "/api/agents/context", description: "Build a token-efficient ecosystem context response with selectable intelligence sections.", auth: "optional_api_key", dataDomains: ["protocols", "risk", "market", "whales", "mev", "gas", "lending", "intent"] },
      { id: "query_protocol_context", method: "POST", path: "/api/v1/context/query", description: "Resolve a protocol and assemble selected overview, TVL, risk and whale context sections.", auth: "optional_api_key", dataDomains: ["entity_resolution", "protocols", "tvl", "risk", "whales"] },
    ],
  },
];

export const NETWORK_CATALOG = [
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    chainIdHex: "0x2105",
    ecosystem: "ethereum",
    nativeAsset: "ETH",
    explorer: "https://basescan.org",
    status: "supported",
  },
] as const;

export const DATASET_CATALOG = [
  { id: "protocols", name: "Protocol directory", description: "Protocol metadata and Base-reported TVL.", source: "DefiLlama", availability: "live" },
  { id: "tvl_history", name: "TVL history", description: "Historical Base chain TVL time series.", source: "DefiLlama", availability: "live" },
  { id: "market", name: "Token market data", description: "Token prices, market capitalization and volume where supported.", source: "CoinGecko and internal cache", availability: "live" },
  { id: "risk", name: "Protocol risk indicators", description: "BaseForge-derived heuristic health and risk indicators.", source: "BaseForge risk engine", availability: "derived" },
  { id: "whales", name: "Large-wallet activity", description: "Indexed large transaction and flow events.", source: "Envio HyperSync with Etherscan fallback", availability: "live" },
  { id: "lending", name: "Lending activity", description: "Supported lending deposits, withdrawals, borrows, repayments and liquidations.", source: "Envio HyperSync with Etherscan fallback", availability: "live" },
  { id: "gas", name: "Network gas", description: "Base network gas and estimated transaction cost metrics.", source: "Etherscan and CoinGecko", availability: "live" },
] as const;

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  source: string;
  calculation: string;
  limitations: string[];
}

export const METRIC_CATALOG: MetricDefinition[] = [
  {
    id: "tvl_usd",
    name: "Total value locked",
    description: "Reported USD value of assets locked in a protocol or across the supported Base protocol set.",
    unit: "USD",
    source: "DefiLlama",
    calculation: "Provider-reported protocol chain TVL for Base; BaseForge protocol lists apply category exclusions where documented.",
    limitations: ["Provider methodology and asset pricing apply.", "Protocol-level values may differ from independently reconstructed on-chain balances."],
  },
  {
    id: "tvl_change_24h_pct",
    name: "TVL change (24h)",
    description: "Percentage change in reported TVL over approximately 24 hours.",
    unit: "percent",
    source: "DefiLlama or BaseForge timestamped TVL history, depending on endpoint.",
    calculation: "Provider-reported change or timestamp-window comparison; consult the endpoint's source metadata.",
    limitations: ["Not all endpoints use the same calculation path.", "Missing provider values must not be interpreted as zero."],
  },
  {
    id: "tvl_change_7d_pct",
    name: "TVL change (7d)",
    description: "Provider-reported percentage change in TVL over seven days.",
    unit: "percent",
    source: "DefiLlama",
    calculation: "Provider-reported protocol change_7d field.",
    limitations: ["Provider methodology applies.", "A missing value is not equivalent to zero."],
  },
  {
    id: "apy_pct",
    name: "Average pool APY",
    description: "Average reported APY across indexed yield pools for a project where available.",
    unit: "percent",
    source: "DefiLlama Yields",
    calculation: "Arithmetic mean of returned pool APY values in the agent context aggregation.",
    limitations: ["Pool-level APY is not a guaranteed return.", "A project average can hide large differences between pools.", "Unavailable APY should be represented as null, not zero."],
  },
  {
    id: "health_score",
    name: "Protocol health score",
    description: "BaseForge heuristic score representing selected protocol health indicators.",
    unit: "score_0_100",
    source: "BaseForge risk engine",
    calculation: "Derived from available audit, TVL, volatility, oracle, category and other supported protocol signals.",
    limitations: ["Not an audit, security guarantee, credit rating or investment recommendation.", "Coverage and input quality vary by protocol."],
  },
  {
    id: "risk_score",
    name: "Protocol risk score",
    description: "BaseForge heuristic risk score on a 0-100 scale.",
    unit: "score_0_100",
    source: "BaseForge risk engine",
    calculation: "Derived as the complement of the health score in the current scoring model.",
    limitations: ["Not a probability of loss or exploit.", "Must be interpreted alongside risk factors and data quality."],
  },
  {
    id: "fees_24h_usd",
    name: "Fees (24h)",
    description: "Reported protocol fees over the latest 24-hour period where available.",
    unit: "USD",
    source: "DefiLlama",
    calculation: "Provider-reported daily fee summary.",
    limitations: ["Endpoint coverage varies.", "Fees are not equivalent to protocol revenue."],
  },
  {
    id: "revenue_24h_usd",
    name: "Revenue (24h)",
    description: "Reported or estimated protocol revenue over the latest 24-hour period.",
    unit: "USD",
    source: "DefiLlama or endpoint-specific fallback",
    calculation: "Provider revenue field when available; some legacy endpoint fallbacks may estimate revenue from fees.",
    limitations: ["Check the endpoint's source and methodology.", "Fallback estimates must not be treated as provider-reported values."],
  },
  {
    id: "base_gas_price_gwei",
    name: "Base gas price",
    description: "Observed Base gas price expressed in gwei.",
    unit: "gwei",
    source: "Etherscan-compatible Base RPC proxy endpoint",
    calculation: "Gas price in wei divided by 1e9.",
    limitations: ["A point-in-time observation; not a guaranteed transaction fee.", "Final cost depends on gas used and L1 data fees."],
  },
  {
    id: "whale_flow_usd",
    name: "Large-wallet flow value",
    description: "Estimated USD value attached to an indexed large-wallet event.",
    unit: "USD",
    source: "Envio HyperSync or Etherscan fallback",
    calculation: "Decoded event/transaction amount valued using available token pricing inputs.",
    limitations: ["Wallet labels and intent are not guaranteed.", "Fallback coverage and valuation precision may differ."],
  },
];

export const OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "BaseForge API",
    version: API_VERSION,
    description: "Machine-readable discovery API for BaseForge on-chain and DeFi intelligence. Discovery endpoints use a versioned data/meta response envelope.",
  },
  servers: [{ url: "https://baseforge-v1.vercel.app" }],
  tags: [{ name: "Discovery", description: "API and data catalog discovery." }],
  paths: {
    "/api/v1": {
      get: {
        tags: ["Discovery"],
        summary: "API entry point",
        responses: { "200": { description: "API links and version metadata." } },
      },
    },
    "/api/v1/capabilities": {
      get: {
        tags: ["Discovery"],
        summary: "List supported API capabilities and operations",
        responses: { "200": { description: "Capability registry." } },
      },
    },
    "/api/v1/catalog": {
      get: {
        tags: ["Discovery"],
        summary: "List supported networks and datasets",
        responses: { "200": { description: "Network and dataset catalog." } },
      },
    },
    "/api/v1/metrics": {
      get: {
        tags: ["Discovery"],
        summary: "Describe metrics, units, sources and limitations",
        responses: { "200": { description: "Metric definitions." } },
      },
    },
    "/api/v1/context/query": {
      post: {
        tags: ["Discovery"],
        summary: "Resolve a protocol and assemble an agent context bundle",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["entity"], properties: { entity: { type: "object", required: ["type"], properties: { type: { const: "protocol" }, id: { type: "string" }, name: { type: "string" }, network: { const: "base" } } }, include: { type: "array", items: { type: "string", enum: ["overview", "tvl", "risk", "whales"] } } } } } },
        },
        responses: { "200": { description: "Resolved protocol context bundle." }, "400": { description: "Invalid query." }, "404": { description: "Entity not found." }, "409": { description: "Ambiguous entity; choose a candidate." } },
      },
    },
    "/api/v1/openapi.json": {
      get: {
        tags: ["Discovery"],
        summary: "Retrieve this OpenAPI document",
        responses: { "200": { description: "OpenAPI 3.1 document." } },
      },
    },
  },
} as const;
