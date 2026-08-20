# BaseForge Python SDK ⚡

Official Python SDK for [BaseForge](https://baseforge-v1.vercel.app) — Real-time on-chain DeFi intelligence, risk scoring, whale flow detection, and transaction generation for AI agents on Base network.

---

## 📦 Installation

```bash
pip install baseforge
```

Or install with optional framework integrations:

```bash
# With LangChain support
pip install "baseforge[langchain]"

# With FastAPI webhook support
pip install "baseforge[fastapi]"
```

---

## 🚀 Quickstart

### 1. Fetching LLM-Optimized Agent Context

```python
from baseforge import BaseForgeClient

client = BaseForgeClient(api_key="your_api_key")  # Optional for public tier

# Fetch high-signal context for an AI Agent
context = client.get_context(
    include="protocols,risk,market,whales,intent",
    top=10,
    compact=False
)

print(f"Base Total TVL: ${context.market.total_tvl:,.2f}")
print(f"Avg Health Score: {context.market.avg_health}/100")

# Inspect high-conviction whale flows
for flow in context.whales.flows:
    print(f"[{flow.protocol}] Whale {flow.type.upper()}: ${flow.usd:,.2f} of {flow.token}")

# Inspect agent intent signals
for intent in context.intents:
    print(f"Signal: {intent.signal} on {intent.protocol} (Confidence: {intent.confidence*100:.0f}%)")
```

---

## 🪝 Webhook Mode (Event-Driven AI Agents)

Trigger cryptographic webhook callbacks from BaseForge to your agent server when market conditions, whale flows, or risk thresholds trigger:

```python
from baseforge import BaseForgeClient

client = BaseForgeClient()

result = client.dispatch_webhook(
    webhook_url="https://agent.yourdomain.com/webhook",
    webhook_secret="your_shared_hmac_secret",
    include="whales,risk,intent",
    filters={
        "min_whale_usd": 100_000,
        "anomaly_only": False,
        "risk_level": "all"
    }
)

print(f"Dispatched: {result.dispatched}, Status: {result.delivery.status}")
```

### Verifying Incoming Webhooks (FastAPI Example)

```python
from fastapi import FastAPI, Header, HTTPException, Request
from baseforge import BaseForgeWebhookVerifier

app = FastAPI()
verifier = BaseForgeWebhookVerifier(secret="your_shared_hmac_secret")

@app.post("/webhook")
async def handle_baseforge_webhook(
    request: Request,
    x_baseforge_signature: str = Header(None)
):
    body = await request.body()
    try:
        # Cryptographically verify HMAC-SHA256 signature
        context = verifier.parse_agent_context(body, x_baseforge_signature)
        print(f"Received verified Base intelligence: TVL=${context.market.total_tvl:,.2f}")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid signature")
```

---

## 🤖 LangChain & OpenAI Agent Tool Integration

```python
from baseforge import get_baseforge_openai_tools, BaseForgeClient
import openai

client = BaseForgeClient()
tools = get_baseforge_openai_tools()

# Pass directly to OpenAI client
response = openai.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "What is the safest lending protocol on Base right now with the highest APY?"}
    ],
    tools=tools,
)
```

---

## 🛠️ Generating Raw EVM Transactions

```python
# Build raw unsigned calldata for 1-Click DEX Swaps or Lending Deposits
tx = client.build_transaction(
    action="swap",
    params={
        "tokenIn": "ETH",
        "tokenOut": "USDC",
        "amountIn": "1000000000000000000",
        "protocol": "aerodrome"
    }
)

print(f"Send TX to: {tx.to}")
print(f"Calldata: {tx.data}")
```
