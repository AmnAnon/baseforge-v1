"""
BaseForge Synchronous Client
Query Base DeFi intelligence, dispatch webhooks, track whale moves, and generate onchain transactions.
"""

from typing import Optional, Dict, Any, List, Union
import httpx
from .models import (
    AgentContext,
    MarketOverview,
    Protocol,
    RiskBreakdown,
    WhaleFlow,
    BuildTxResult,
    WebhookDispatchResult,
)


class BaseForgeClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://baseforge-v1.vercel.app",
        timeout: float = 15.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._headers = {"User-Agent": "BaseForge-Python-SDK/0.2.0"}
        if self.api_key:
            self._headers["x-api-key"] = self.api_key

    def _get_client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, headers=self._headers, timeout=self.timeout)

    def get_context(
        self,
        include: str = "protocols,risk,market,whales,intent",
        protocol: Optional[str] = None,
        timeframe: str = "24h",
        top: int = 15,
        compact: bool = False,
    ) -> AgentContext:
        """
        Fetch compressed, LLM-optimized Base DeFi intelligence.
        """
        params: Dict[str, Union[str, int]] = {
            "include": include,
            "timeframe": timeframe,
            "top": top,
            "compact": "true" if compact else "false",
        }
        if protocol:
            params["protocol"] = protocol

        with self._get_client() as client:
            resp = client.get("/api/agents/context", params=params)
            resp.raise_for_status()
            data = resp.json()
            return AgentContext.model_validate(data)

    def dispatch_webhook(
        self,
        webhook_url: str,
        webhook_secret: str = "baseforge-agent-secret",
        include: str = "protocols,risk,market,whales,intent",
        protocol: Optional[str] = None,
        timeframe: str = "24h",
        top: int = 15,
        compact: bool = False,
        filters: Optional[Dict[str, Any]] = None,
    ) -> WebhookDispatchResult:
        """
        Request context generation and cryptographic webhook dispatch to your agent server.
        """
        payload: Dict[str, Any] = {
            "webhook_url": webhook_url,
            "webhook_secret": webhook_secret,
            "include": include,
            "timeframe": timeframe,
            "top": top,
            "compact": "true" if compact else "false",
        }
        if protocol:
            payload["protocol"] = protocol
        if filters:
            payload["filters"] = filters

        with self._get_client() as client:
            resp = client.post("/api/agents/context", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return WebhookDispatchResult.model_validate(data)

    def get_market_overview(self) -> Optional[MarketOverview]:
        """Fetch general Base DeFi ecosystem metrics."""
        ctx = self.get_context(include="market", top=5, compact=True)
        return ctx.market

    def get_top_protocols(self, top: int = 10) -> List[Protocol]:
        """Fetch top Base protocols ranked by TVL with health and risk metrics."""
        ctx = self.get_context(include="protocols,risk", top=top)
        return ctx.protocols

    def get_whale_flows(self, min_usd: float = 50_000, limit: int = 20) -> List[WhaleFlow]:
        """Fetch high-conviction onchain whale transactions on Base."""
        ctx = self.get_context(include="whales", top=5)
        if not ctx.whales:
            return []
        return [f for f in ctx.whales.flows if f.usd >= min_usd][:limit]

    def get_risk(self) -> Optional[RiskBreakdown]:
        """Fetch ecosystem-wide concentration risk, anomalies, and health scores."""
        ctx = self.get_context(include="risk", top=5)
        return ctx.risk

    def build_transaction(
        self,
        action: str,
        params: Dict[str, Any],
    ) -> BuildTxResult:
        """
        Generate raw unsigned EVM transaction calldata for AI agent execution.
        """
        payload = {"action": action, "params": params}
        with self._get_client() as client:
            resp = client.post("/api/agents/actions/build-tx", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return BuildTxResult.model_validate(data)
