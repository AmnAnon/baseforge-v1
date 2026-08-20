"""
BaseForge Python SDK
The official Python client for BaseForge AI Agent Context, Webhooks, and Base DeFi Intelligence.
"""

from .client import BaseForgeClient
from .async_client import AsyncBaseForgeClient
from .webhooks import (
    BaseForgeWebhookVerifier,
    WebhookVerificationError,
    verify_webhook,
)
from .models import (
    AgentContext,
    MarketOverview,
    Protocol,
    RiskBreakdown,
    WhaleFlow,
    LendingEvent,
    IntentSignal,
    GasData,
    BuildTxResult,
    WebhookDispatchResult,
)
from .agent_tools import (
    get_baseforge_openai_tools,
    BaseForgeLangChainTool,
)

__version__ = "0.2.0"
__all__ = [
    "BaseForgeClient",
    "AsyncBaseForgeClient",
    "BaseForgeWebhookVerifier",
    "WebhookVerificationError",
    "verify_webhook",
    "AgentContext",
    "MarketOverview",
    "Protocol",
    "RiskBreakdown",
    "WhaleFlow",
    "LendingEvent",
    "IntentSignal",
    "GasData",
    "BuildTxResult",
    "WebhookDispatchResult",
    "get_baseforge_openai_tools",
    "BaseForgeLangChainTool",
]
