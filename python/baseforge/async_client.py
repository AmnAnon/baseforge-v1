"""
BaseForge Asynchronous Client
Async/await client for high-throughput AI agent pipelines (FastAPI, LangChain, AutoGen, CrewAI).
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


class AsyncBaseForgeClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://baseforge-v1.vercel.app",
        timeout: float = 15.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._headers = {"User-Agent": "BaseForge-Python-SDK/0.2.0 (Async)"}
        if self.api_key:
            self._headers["x-api-key"] = self.api_key

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, headers=self._headers, timeout=self.timeout)

    async def get_context(
        self,
        include: str = "protocols,risk,market,whales,intent",
        protocol: Optional[str] = None,
        timeframe: str = "24h",
        top: int = 15,
        compact: bool = False,
    ) -> AgentContext:
        """Fetch compressed, LLM-optimized Base DeFi intelligence asynchronously."""
        params: Dict[str, Union[str, int]] = {
            "include": include,
            "timeframe": timeframe,
            "top": top,
            "compact": "true" if compact else "false",
        }
        if protocol:
            params["protocol"] = protocol

        async with self._get_client() as client:
            resp = await client.get("/api/agents/context", params=params)
            resp.raise_for_status()
            data = resp.json()
            return AgentContext.model_validate(data)

    async def dispatch_webhook(
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
        """Request context generation and cryptographic webhook dispatch asynchronously."""
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

        async with self._get_client() as client:
            resp = await client.post("/api/agents/context", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return WebhookDispatchResult.model_validate(data)

    async def get_market_overview(self) -> Optional[MarketOverview]:
        ctx = await self.get_context(include="market", top=5, compact=True)
        return ctx.market

    async def get_top_protocols(self, top: int = 10) -> List[Protocol]:
        ctx = await self.get_context(include="protocols,risk", top=top)
        return ctx.protocols

    async def get_whale_flows(self, min_usd: float = 50_000, limit: int = 20) -> List[WhaleFlow]:
        ctx = await self.get_context(include="whales", top=5)
        if not ctx.whales:
            return []
        return [f for f in ctx.whales.flows if f.usd >= min_usd][:limit]

    async def get_risk(self) -> Optional[RiskBreakdown]:
        ctx = await self.get_context(include="risk", top=5)
        return ctx.risk

    async def build_transaction(
        self,
        action: str,
        params: Dict[str, Any],
    ) -> BuildTxResult:
        payload = {"action": action, "params": params}
        async with self._get_client() as client:
            resp = await client.post("/api/agents/actions/build-tx", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return BuildTxResult.model_validate(data)
