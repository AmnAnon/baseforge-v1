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

## Interactive Examples

Visit `/api/agents/examples` for:
- Full endpoint reference with all parameters
- Common query patterns with token estimates
- Example response payloads
- Schema field reference

```bash
curl https://your-baseforge.vercel.app/api/agents/examples | jq
```
