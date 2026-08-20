"""
BaseForge Webhook Verification and Event Handlers
Provides HMAC-SHA256 cryptographic verification for BaseForge Agent Context & Alert webhooks.
"""

import hmac
import hashlib
import json
from typing import Union, Dict, Any, Optional
from .models import AgentContext


class WebhookVerificationError(Exception):
    """Raised when webhook signature verification fails."""
    pass


class BaseForgeWebhookVerifier:
    def __init__(self, secret: str):
        if not secret:
            raise ValueError("Webhook secret must be provided")
        self.secret = secret

    def verify_signature(
        self,
        payload: Union[str, bytes],
        signature_header: str,
    ) -> bool:
        """
        Verify the X-BaseForge-Signature header against the raw request payload.
        Expected header format: 'sha256=<hex_digest>'
        """
        if not signature_header:
            return False

        if signature_header.startswith("sha256="):
            signature_hex = signature_header[7:]
        else:
            signature_hex = signature_header

        payload_bytes = payload.encode("utf-8") if isinstance(payload, str) else payload

        expected_signature = hmac.new(
            self.secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(signature_hex, expected_signature)

    def parse_event(
        self,
        payload: Union[str, bytes],
        signature_header: Optional[str] = None,
        verify: bool = True,
    ) -> Dict[str, Any]:
        """
        Verify signature and parse incoming webhook event payload.
        """
        if verify:
            if not signature_header or not self.verify_signature(payload, signature_header):
                raise WebhookVerificationError("Invalid or missing webhook signature")

        raw_str = payload.decode("utf-8") if isinstance(payload, bytes) else payload
        return json.loads(raw_str)

    def parse_agent_context(
        self,
        payload: Union[str, bytes],
        signature_header: Optional[str] = None,
        verify: bool = True,
    ) -> AgentContext:
        """
        Verify signature and parse into typed AgentContext model.
        """
        event_dict = self.parse_event(payload, signature_header, verify=verify)
        context_data = event_dict.get("context", event_dict)
        return AgentContext.model_validate(context_data)


def verify_webhook(
    payload: Union[str, bytes],
    signature: str,
    secret: str,
) -> bool:
    """Convenience helper to verify HMAC-SHA256 signature."""
    verifier = BaseForgeWebhookVerifier(secret)
    return verifier.verify_signature(payload, signature)
