# @baseforge/sdk

Small, dependency-free TypeScript client for BaseForge's versioned discovery and agent-context API.

## Install

```bash
npm install @baseforge/sdk
```

## Quickstart

```ts
import { BaseForgeClient } from "@baseforge/sdk";

const baseforge = new BaseForgeClient({
  apiKey: process.env.BASEFORGE_API_KEY, // optional for public access
});

const capabilities = await baseforge.getCapabilities();
console.log(capabilities.data.capabilities);

const context = await baseforge.getProtocolContext({
  entity: { type: "protocol", id: "aerodrome-slipstream" },
  include: ["overview", "tvl", "risk"],
});

console.log(context.data.entity.id);
console.log(context.data.sections.tvl);
```

## Discovery

- `getCapabilities()` — available operations and access requirements
- `getCatalog()` — supported networks and datasets
- `getMetricDefinitions()` — metric semantics, units, sources and limitations
- `getProtocolContext(query)` — canonical protocol resolution and selected context sections

The SDK preserves the API's `data/meta` envelope so callers can retain request IDs and timestamps. Non-2xx responses throw `BaseForgeApiError` with the HTTP status and machine-readable error code when available.

## Configuration

| Option | Default | Purpose |
|---|---|---|
| `baseUrl` | BaseForge production URL | Point to a preview or self-hosted deployment |
| `apiKey` | none | Optional API key |
| `timeoutMs` | 15000 | Request timeout |
| `fetch` | global fetch | Inject a custom fetch implementation for tests or runtimes |
