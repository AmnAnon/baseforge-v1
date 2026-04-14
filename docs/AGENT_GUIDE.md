# How to Use BaseForge as Your AI DeFi Brain

> BaseForge provides a single compressed API endpoint that gives any LLM instant awareness of the entire Base DeFi ecosystem — protocols, risks, whale activity, gas conditions, and intent signals.

## Quick Start

Fetch the full Base ecosystem state in one call:

```bash
curl https://your-baseforge.vercel.app/api/agents/context?include=all
```

Paste the JSON response into any LLM (Claude, GPT, Gemini, o1, local models) along with your question.

---

## For AI Agents (Automated)

### TypeScript/Node.js

```typescript
const BASE_URL = "https://your-baseforge.vercel.app";

async function getBaseContext(options?: {
  include?: string;
  protocol?: string;
  compact?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.include) params.set("include", options.include);
  if (options?.protocol) params.set("protocol", options.protocol);
  if (options?.compact) params.set("compact", "true");

  const res = await fetch(`${BASE_URL}/api/agents/context?${params}`);
  return res.json();
}

// Full overview
const context = await getBaseContext({ include: "all" });

// Quick risk scan (minimal tokens)
const risk = await getBaseContext({ include: "risk,market", compact: true });

// Aerodrome-specific with whale activity
const aero = await getBaseContext({
  include: "protocols,whales,intent",
  protocol: "aerodrome"
});
```

### Python

```python
import requests

BASE_URL = "https://your-baseforge.vercel.app"

def get_base_context(include="all", protocol=None, compact=False):
    params = {"include": include}
    if protocol:
        params["protocol"] = protocol
    if compact:
        params["compact"] = "true"
    return requests.get(f"{BASE_URL}/api/agents/context", params=params).json()

# Full intelligence
ctx = get_base_context()

# Just risk and market
risk = get_base_context(include="risk,market", compact=True)
```

---

## Prompt Templates

### Template 1: DeFi Analyst

Copy-paste this into Claude, GPT, or any LLM:

```
You are a DeFi analyst specializing in the Base blockchain ecosystem.

Here is the current state of Base DeFi protocols, risk scores, whale activity,
and market conditions from BaseForge Analytics:

<base_defi_context>
{paste JSON from /api/agents/context?include=all here}
</base_defi_context>

INSTRUCTIONS:
- Analyze the data provided above. It is real-time, not hypothetical.
- "health" is 0-100 (higher = safer). "risk" is 100 - health.
- "c1d" and "c7d" are TVL percentage changes over 1 day and 7 days.
- "dom" is the protocol's share of total Base TVL.
- "level" is the risk classification: low, medium, or high.
- "factors" lists specific risk concerns.
- If "intents" are present, they represent detected whale behavior patterns.
- The "risk.concentration.hhi" is a Herfindahl index (>2500 = concentrated market).

Based on this data, please:
1. Summarize the current state of Base DeFi in 2-3 sentences.
2. Identify the top 3 risks right now.
3. Highlight any anomalies or unusual activity.
4. If intent signals are present, explain what smart money is doing.
5. Give one actionable recommendation for a DeFi user on Base.
```

### Template 2: Risk Monitor (Automated Agent)

For agents that run on a schedule:

```
You are an automated DeFi risk monitor for the Base blockchain.

Current ecosystem state:
<context>
{paste JSON from /api/agents/context?include=risk,whales,intent&compact=true}
</context>

TASK: Evaluate whether any protocol requires immediate attention.

ALERT CRITERIA:
- Any protocol with risk > 60 AND tvl > $5M → RED ALERT
- Any anomaly with severity "high" → ORANGE ALERT
- Net outflows > $500K from a single protocol → YELLOW ALERT
- Intent signal "distribution" with confidence > 0.5 → YELLOW ALERT
- All clear → GREEN

OUTPUT FORMAT:
{
  "status": "RED|ORANGE|YELLOW|GREEN",
  "alerts": [{"protocol": "...", "reason": "...", "severity": "..."}],
  "summary": "One sentence.",
  "action": "Recommended action if any."
}
```

### Template 3: Portfolio Advisor

```
You are a DeFi portfolio advisor for the Base ecosystem.

Current market intelligence:
<baseforge>
{paste JSON from /api/agents/context?include=all&top=20}
</baseforge>

The user's current positions: [user describes their holdings]

TASK:
1. Assess risk exposure based on the protocol health scores.
2. Check if any held protocols have anomalies or high risk factors.
3. Identify yield opportunities (protocols with APY > 5% and health > 70).
4. Suggest rebalancing if concentration risk is high.
5. Flag any intent signals (accumulation/distribution) relevant to their holdings.

Be specific. Reference protocol names, health scores, and TVL changes.
Don't give generic advice — use the real data.
```

---

## Response Schema Reference

Every response from `/api/agents/context` follows this structure:

| Field | Type | Description |
|---|---|---|
| `_v` | string | Schema version ("2.0") |
| `_schema` | string | Schema identifier |
| `_ts` | number | Unix timestamp (ms) |
| `_iso` | string | ISO 8601 timestamp |
| `_chain` | string | Always "base" |
| `_chainId` | number | 8453 |
| `_source` | string | Data provider ("envio-hypersync" or "etherscan-fallback") |
| `_latencyMs` | number | Server build time |
| `_ttl` | number | Cache TTL in seconds |
| `_next` | string | ISO timestamp for next fresh data |

### Market Section (`market`)

| Field | Type | Description |
|---|---|---|
| `totalTvl` | number | Total Base TVL in USD |
| `protocols` | number | Count of active protocols |
| `avgApy` | number | Average yield across protocols |
| `avgHealth` | number | Average health score (0-100) |
| `tvlTrend` | string | "up" / "flat" / "down" (30d direction) |
| `tvlTrendPct` | number | 30d TVL change percentage |

### Protocol Objects (`protocols[]`)

| Field | Type | Description |
|---|---|---|
| `id` | string | Protocol slug |
| `name` | string | Display name |
| `cat` | string | Category (Dexes, Lending, etc.) |
| `tvl` | number | TVL in USD |
| `c1d` | number | 24h TVL change % |
| `c7d` | number | 7d TVL change % |
| `c30d` | number? | 30d TVL change % (when available) |
| `apy` | number | Average yield % |
| `dom` | number | % of total Base TVL |
| `health` | number | Health score 0-100 |
| `risk` | number | Risk score (100 - health) |
| `level` | string | "low" / "medium" / "high" |
| `audit` | string | "audited" / "partial" / "unaudited" |
| `factors` | string[] | Risk factor identifiers |

### Risk Section (`risk`)

| Field | Type | Description |
|---|---|---|
| `avgHealth` | number | Average health across all protocols |
| `highRiskCount` | number | Protocols with risk > 50 |
| `highRiskProtocols` | string[] | Top 5 high-risk protocol slugs |
| `unauditedCount` | number | Protocols without audits |
| `concentration.level` | string | "HIGH" / "MEDIUM" / "LOW" |
| `concentration.hhi` | number | Herfindahl index (0-10000) |
| `anomalies[]` | object[] | Detected anomalies with severity |
| `confidence` | number | 0-1 confidence in risk assessment |

### Intent Signals (`intents[]`)

| Field | Type | Description |
|---|---|---|
| `signal` | string | "accumulation" / "distribution" / "yield_rotation" / "risk_escalation" |
| `protocol` | string | Affected protocol |
| `confidence` | number | 0-1 |
| `evidence` | string | Data-backed explanation |
| `actionable` | string | What this means for the user |

---

## Query Parameters

| Param | Values | Default | Description |
|---|---|---|---|
| `include` | protocols,risk,market,whales,mev,gas,lending,intent | protocols,risk,market | Comma-separated sections to include. Use `all` for everything. |
| `protocol` | any protocol slug | (none) | Filter to a specific protocol |
| `timeframe` | 1h, 6h, 24h | 24h | Time window for whale/activity data |
| `top` | 1-50 | 15 | Number of protocols to return |
| `compact` | true/false | false | Strip verbose fields for minimal token usage |

## Token Usage Estimates

| Query | Approx. Tokens |
|---|---|
| `?include=risk,market&compact=true` | ~400 |
| `?include=protocols,risk,market&top=5` | ~600 |
| `?include=protocols,whales,intent` | ~800 |
| `?include=all&top=15` | ~1500 |
| `?include=all&top=50` | ~3000 |

---

## Rate Limits

- **Agent endpoint:** 20 requests/minute per IP
- **Other API routes:** 10 requests/minute per IP
- Rate limit headers: `Retry-After` on 429 responses

## Response Headers

Every response includes:
- `X-Data-Source`: Which provider served the data (`envio-hypersync` or `etherscan-fallback`)
- `X-Cache-Status`: `HIT`, `MISS`, or `STALE`
- `Cache-Control`: Appropriate browser/CDN caching directives

## Error Handling

The endpoint never returns non-200 errors. On failure, it returns:
```json
{
  "_v": "2.0",
  "_stale": true,
  "_error": "context_build_failed",
  "market": { "totalTvl": 0, "protocols": 0 },
  "protocols": [],
  "risk": { "avgHealth": 0, "anomalies": [] }
}
```

Check `_stale: true` or `_error` to detect degraded responses.

---

## Whale Tracker API

The `/api/whales` endpoint returns enriched smart money flows with intent classification and whale scoring.

```bash
# Basic — default $10K threshold
curl https://your-app.vercel.app/api/whales

# Custom threshold and limit
curl "https://your-app.vercel.app/api/whales?min=25000&limit=100"

# Low threshold for high volume ($5K)
curl "https://your-app.vercel.app/api/whales?min=5000&limit=200"
```

### Response Fields

| Field | Description |
|---|---|
| `whales[].intent` | Raw intent type: `accumulation`, `distribution`, `lp_entry`, `lp_exit`, `leverage`, `deleverage`, `arbitrage`, `transfer` |
| `whales[].intentLabel` | Human-readable label (e.g. "Accumulation", "LP Exit") |
| `whales[].intentColor` | CSS variable for the intent color |
| `whales[].intentConfidence` | Classification confidence (0-1) |
| `whales[].whaleScore` | Whale score (0-100) based on volume, activity, protocol diversity, type mix |
| `whales[].fromLabel` | Smart wallet label if known (e.g. "Aerodrome: Treasury") |
| `whales[].toLabel` | Same for destination address |
| `whaleProfiles[]` | Top active whale wallets with score, tx count, volume, protocols |
| `hotSignals[]` | Detected patterns: repeated whale moves, arbitrage, accumulation clusters |

### Whale Score Factors

Score is computed 0-100 from:
- **Volume (0-40):** `log2(totalVolume / 10000) * 8`, capped at 40
- **Activity (0-25):** `txCount * 3`, capped at 25
- **Protocol Diversity (0-20):** `uniqueProtocols * 5`, capped at 20
- **Type Diversity (0-15):** `uniqueTypes * 4`, capped at 15

### AI Summary Prompt Template

The whale tracker includes a one-line AI summary. To regenerate or customize:

```
Given these whale flows: {JSON of last 20 transactions},
Provide a one-sentence summary highlighting:
1. Total volume moved and number of transactions
2. Dominant intent (accumulation vs distribution)
3. Any unusual patterns (arb, large LP exits, repeated whale)
4. Top active whale if score >= 70
5. Hottest protocol by transaction count
Keep it under 120 characters. Use "·" as separator. Prefix with "$" for shell style.
```

---

## Interactive Examples

Visit `/api/agents/examples` for:
- Full endpoint reference with all parameters
- Common query patterns with token estimates
- Example response payloads
- Schema field reference

```bash
curl https://your-baseforge.vercel.app/api/agents/examples | jq
```

---

## TypeScript Client Types

Generate or use these types for type-safe integration:

```typescript
// Response shape from /api/agents/context v2
interface AgentContext {
  _v: "2.0";
  _schema: "baseforge.agent.context";
  _ts: number;
  _iso: string;
  _chain: "base";
  _chainId: 8453;
  _source: string;
  _latencyMs: number;
  _params: { include: string[]; protocol: string | null; timeframe: string; top: number };
  market?: { totalTvl: number; protocols: number; avgApy: number; avgHealth: number; tvlTrend: "up" | "down" | "flat"; tvlTrendPct: number; topCategory: string };
  protocols?: Array<{
    id: string; name: string; cat: string; tvl: number;
    c1d: number; c7d: number; c30d?: number; apy: number;
    dom: number; health: number; risk: number; level: "low" | "medium" | "high";
    audit: "audited" | "partial" | "unaudited"; factors: string[];
  }>;
  risk?: {
    avgHealth: number; highRiskCount: number; highRiskProtocols: string[];
    unauditedCount: number;
    concentration: { level: "HIGH" | "MEDIUM" | "LOW"; dominant: string; dominantPct: number; hhi: number };
    anomalies: Array<{ id: string; reason: string; severity: string }>;
    confidence: number;
  };
  whales?: {
    flows: Array<{
      tx: string; from: string; to: string; fromLabel?: string; toLabel?: string;
      usd: number; token: string; amount: string; type: string; protocol: string;
      intent: string; intentLabel: string; intentColor: string;
      intentConfidence: number; whaleScore?: number;
    }>;
    summary: { totalVolumeUSD: number; largestFlowUSD: number; netFlowUSD: number; activeWhales: number };
    whaleProfiles: Array<{ address: string; score: number; txCount: number; totalVolume: number; protocols: string[]; label?: string }>;
    hotSignals: Array<{ id: string; type: string; description: string; confidence: number; transactions: string[] }>;
  };
  lending?: { events: Array<{ tx: string; action: string; protocol: string; asset: string; usd: number; user: string }>; summary: { totalDepositsUSD: number; totalBorrowsUSD: number } };
  gas?: { baseFeeGwei: number; congestion: "low" | "medium" | "high"; estTxCostUSD: number };
  mev?: { status: "heuristic"; confidence: number; note: string; estimatedExtraction24h: number; sandwichCount: number; arbitrageCount: number };
  intents?: Array<{ signal: string; protocol: string; confidence: number; evidence: string; actionable: string }>;
  _ttl: number;
  _next: string;
}
```

### Full Client Class (TypeScript)

```typescript
class BaseForgeClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  async getContext(options?: {
    include?: string;
    protocol?: string;
    timeframe?: "1h" | "6h" | "24h";
    top?: number;
    compact?: boolean;
  }): Promise<AgentContext> {
    const params = new URLSearchParams({
      include: options?.include ?? "all",
      ...(options?.protocol && { protocol: options.protocol }),
      ...(options?.timeframe && { timeframe: options.timeframe }),
      ...(options?.top && { top: String(options.top) }),
      ...(options?.compact && { compact: "true" }),
    });

    const res = await fetch(`${this.baseUrl}/api/agents/context?${params}`, {
      headers: { "X-API-Key": this.apiKey },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(`BaseForge API error: ${error.error ?? "unknown"}`);
    }

    return res.json() as Promise<AgentContext>;
  }
}

// Usage
const client = new BaseForgeClient("https://your-app.vercel.app", "bf_your_key_here");
const ctx = await client.getContext({ include: "all", top: 10 });
console.log(ctx.market?.totalTvl);
console.log(ctx.intents?.[0]?.signal);
```

---

## Python Client Types

```python
from dataclasses import dataclass
from typing import Optional, List
import requests

@dataclass
class Protocol:
    id: str
    name: str
    cat: str
    tvl: int
    c1d: float
    c7d: float
    apy: float
    dom: float
    health: int
    risk: int
    level: str  # "low", "medium", "high"
    audit: str  # "audited", "partial", "unaudited"
    factors: List[str]

@dataclass
class MarketOverview:
    total_tvl: int
    protocols: int
    avg_apy: float
    avg_health: int
    tvl_trend: str  # "up", "down", "flat"
    tvl_trend_pct: float
    top_category: str

class BaseForgeClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def get_context(self, include: str = "all", protocol: str = None,
                    timeframe: str = "24h", top: int = 15, compact: bool = False) -> dict:
        params = {"include": include, "timeframe": timeframe, "top": str(top)}
        if protocol:
            params["protocol"] = protocol
        if compact:
            params["compact"] = "true"

        headers = {"X-API-Key": self.api_key}
        res = requests.get(f"{self.base_url}/api/agents/context", params=params, headers=headers)
        res.raise_for_status()
        return res.json()

# Usage
client = BaseForgeClient("https://your-app.vercel.app", "bf_your_key_here")
ctx = client.get_context(include="all", top=10)
print(ctx["market"]["totalTvl"])
```

---

## Authentication & Rate Limits

All data endpoints require an API key. Get one from your admin dashboard:

```bash
# Create a free-tier key
curl -X POST https://your-app.vercel.app/api/admin/api-keys \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "tier": "free"}'
```

| Tier | Rate Limit | Headers |
|------|-----------|---------|
| `free` | 100 req/min | `X-RateLimit-Tier: free`, `X-RateLimit-Limit: 100` |
| `pro` | 1000 req/min | `X-RateLimit-Tier: pro`, `X-RateLimit-Limit: 1000` |
| `enterprise` | 10000 req/min | `X-RateLimit-Tier: enterprise`, `X-RateLimit-Limit: 10000` |

Pass your key via:
- Header (preferred): `X-API-Key: bf_...`
- Query param: `?apiKey=bf_...`

---

## OpenAPI Specification

Full OpenAPI 3.1 spec is available at:
- **Public**: `https://your-app.vercel.app/openapi.json`
- **GitHub**: [`public/openapi.json`](../public/openapi.json)

Use it with:
- **Scalar**: `https://your-app.vercel.app/api-docs` (if hosted)
- **Swagger Editor**: Paste `openapi.json` at [editor.swagger.io](https://editor.swagger.io)
- **Codegen**: Generate TypeScript/Python/Go clients via `openapi-generator`
