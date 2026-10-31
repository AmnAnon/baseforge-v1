# BaseForge agent skill

Use BaseForge as a structured source of Base ecosystem intelligence. Prefer the versioned discovery and context API over guessing endpoint paths or interpreting raw provider payloads.

## First connection

1. Read `GET /api/v1`.
2. Read `GET /api/v1/capabilities` to discover available operations and access requirements.
3. Read `GET /api/v1/catalog` for supported networks and datasets.
4. Read `GET /api/v1/metrics` before interpreting numeric fields.

Base URL: `https://baseforge-v1.vercel.app`

## Resolve and query a protocol

Call `POST /api/v1/context/query`:

```json
{
  "entity": {
    "type": "protocol",
    "id": "aerodrome-slipstream",
    "network": "base"
  },
  "include": ["overview", "tvl", "risk", "whales"]
}
```

Use `entity.name` if you only know the display name. Canonical protocol IDs have the form `protocol:base:{slug}`. A HTTP 409 response means the name is ambiguous; ask the user or select from the returned candidate IDs. Do not guess. HTTP 404 means the entity is not in the supported Base protocol directory.

Supported context sections:
- `overview`: canonical identity and provider metadata
- `tvl`: provider-reported TVL and percentage changes
- `risk`: BaseForge heuristic health/risk indicators and factors
- `whales`: indexed large-wallet activity where provider coverage exists

## Interpretation rules

- Preserve `meta.requestId`, `meta.generatedAt` and `meta.apiVersion` when storing or passing results downstream.
- Each section's `provenance` and `quality` describe its source, freshness and completeness.
- Missing or null data is not zero.
- TVL is provider-reported; retain its provider attribution.
- Risk scores are BaseForge heuristics, not audits, exploit probabilities or guarantees.
- Whale events are indexed observations. Wallet identity, ownership and intent are not guaranteed.
- Do not combine values with different source, observation time or methodology without explicitly disclosing the difference.
- Never invent confidence values or infer missing data.

## Authentication and limits

Public access is available for discovery and context queries. An optional API key may be sent in the `X-API-Key` header for account-level usage tracking and applicable higher limits. Do not expose API keys in prompts, logs or tool output.

## API usage

An API key holder can call `GET /api/v1/usage` to inspect only that key's request totals, endpoint breakdown and remaining rolling quotas. Preserve the `X-RateLimit-*` and `X-Quota-*` response headers when building clients. This endpoint requires `X-API-Key`.

## MCP

For MCP-compatible clients, use the BaseForge MCP server. Its discovery tools include `get_api_capabilities`, `get_data_catalog`, `get_metric_definitions`, `search_protocols` and `get_protocol_context`. Read-only MCP resources are available at `baseforge://capabilities`, `baseforge://catalog` and `baseforge://metrics`.

## Safety

The data is informational. Do not present it as personalized financial advice. The transaction builder, where available, produces unsigned transaction data; an agent must not sign or broadcast transactions without explicit user authorization and a separate wallet security flow.
