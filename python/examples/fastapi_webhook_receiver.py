"""
FastAPI Agent Webhook Server
Receives and cryptographically verifies HMAC-SHA256 BaseForge webhooks.
"""

from fastapi import FastAPI, Header, HTTPException, Request
from baseforge import BaseForgeWebhookVerifier

app = FastAPI(title="BaseForge Agent Webhook Receiver")
WEBHOOK_SECRET = "your-custom-webhook-secret"
verifier = BaseForgeWebhookVerifier(secret=WEBHOOK_SECRET)

@app.post("/api/baseforge-webhook")
async def receive_webhook(
    request: Request,
    x_baseforge_signature: str = Header(None),
    x_baseforge_event: str = Header(None),
):
    body_bytes = await request.body()
    try:
        context = verifier.parse_agent_context(body_bytes, x_baseforge_signature)
        print(f"✅ Webhook Verified: Event '{x_baseforge_event}' received!")
        print(f"   Base TVL: ${context.market.total_tvl:,.2f}")
        return {"ok": True, "processed": True}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"HMAC Verification Failed: {str(e)}")
