"""
BaseForge Data Models
Pydantic models for Base DeFi protocol intelligence, risk metrics, whale flows, and agent transaction payloads.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class MarketOverview(BaseModel):
    total_tvl: float = Field(default=0.0, alias="totalTvl")
    protocols_count: int = Field(default=0, alias="protocols")
    avg_apy: float = Field(default=0.0, alias="avgApy")
    avg_health: int = Field(default=0, alias="avgHealth")
    tvl_trend: Literal["up", "flat", "down"] = Field(default="flat", alias="tvlTrend")
    tvl_trend_pct: float = Field(default=0.0, alias="tvlTrendPct")
    top_category: str = Field(default="Unknown", alias="topCategory")


class Protocol(BaseModel):
    id: str
    name: Optional[str] = None
    cat: Optional[str] = None
    tvl: float = 0.0
    c1d: Optional[float] = None
    c7d: Optional[float] = None
    c30d: Optional[float] = None
    apy: Optional[float] = None
    dom: Optional[float] = None
    health: int = 50
    risk: int = 50
    level: Literal["low", "medium", "high"] = "medium"
    audit: Optional[str] = None
    factors: List[str] = Field(default_factory=list)


class RiskAnomaly(BaseModel):
    id: str
    reason: str
    severity: Literal["low", "medium", "high"]


class Concentration(BaseModel):
    level: Literal["LOW", "MEDIUM", "HIGH"] = "LOW"
    dominant: str = "N/A"
    dominant_pct: float = Field(default=0.0, alias="dominantPct")
    hhi: float = 0.0


class RiskBreakdown(BaseModel):
    avg_health: int = Field(default=50, alias="avgHealth")
    high_risk_count: int = Field(default=0, alias="highRiskCount")
    high_risk_protocols: List[str] = Field(default_factory=list, alias="highRiskProtocols")
    unaudited_count: int = Field(default=0, alias="unauditedCount")
    concentration: Optional[Concentration] = None
    anomalies: List[RiskAnomaly] = Field(default_factory=list)
    confidence: float = 0.8


class WhaleFlow(BaseModel):
    tx: str
    protocol: str
    type: Literal["swap", "deposit", "withdraw", "borrow", "repay", "other"] = "other"
    usd: float
    token: str
    amount: str
    from_address: Optional[str] = Field(default=None, alias="from")
    to_address: Optional[str] = Field(default=None, alias="to")
    block: Optional[int] = None


class WhaleSummary(BaseModel):
    total_volume_usd: float = Field(default=0.0, alias="totalVolumeUSD")
    largest_flow_usd: float = Field(default=0.0, alias="largestFlowUSD")
    net_flow_usd: float = Field(default=0.0, alias="netFlowUSD")
    by_type: Dict[str, int] = Field(default_factory=dict, alias="byType")


class WhalesSection(BaseModel):
    flows: List[WhaleFlow] = Field(default_factory=list)
    summary: Optional[WhaleSummary] = None
    count: int = 0
    source: str = "envio-hypersync"


class LendingEvent(BaseModel):
    tx: str
    action: str
    protocol: str
    asset: str
    usd: float
    user: str


class LendingSection(BaseModel):
    events: List[LendingEvent] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    source: str = "envio-hypersync"


class IntentSignal(BaseModel):
    signal: Literal["accumulation", "distribution", "yield_rotation", "risk_escalation"]
    protocol: str
    confidence: float
    evidence: str
    actionable: bool = True
    suggested_action: Optional[str] = None


class GasData(BaseModel):
    base_fee_gwei: float = Field(default=0.001, alias="baseFeeGwei")
    congestion: Literal["low", "medium", "high"] = "low"
    est_tx_cost_usd: float = Field(default=0.001, alias="estTxCostUSD")


class MevSection(BaseModel):
    status: str = "heuristic"
    confidence: float = 0.3
    note: str = ""
    estimated_extraction_24h: float = Field(default=0.0, alias="estimatedExtraction24h")
    sandwich_count: int = Field(default=0, alias="sandwichCount")
    arbitrage_count: int = Field(default=0, alias="arbitrageCount")


class AgentContext(BaseModel):
    version: str = Field(default="2.0", alias="_v")
    schema_name: str = Field(default="baseforge.agent.context", alias="_schema")
    timestamp: int = Field(default=0, alias="_ts")
    iso: str = Field(default="", alias="_iso")
    chain: str = Field(default="base", alias="_chain")
    chain_id: int = Field(default=8453, alias="_chainId")
    source: str = Field(default="envio-hypersync", alias="_source")
    latency_ms: int = Field(default=0, alias="_latencyMs")
    tier: str = Field(default="public", alias="_tier")
    market: Optional[MarketOverview] = None
    protocols: List[Protocol] = Field(default_factory=list)
    risk: Optional[RiskBreakdown] = None
    whales: Optional[WhalesSection] = None
    lending: Optional[LendingSection] = None
    intents: List[IntentSignal] = Field(default_factory=list)
    gas: Optional[GasData] = None
    mev: Optional[MevSection] = None


class WebhookDelivery(BaseModel):
    status: int
    error: Optional[str] = None
    latency_ms: int = Field(default=0, alias="latencyMs")
    signature: str
    timestamp: int


class WebhookDispatchResult(BaseModel):
    ok: bool
    dispatched: bool
    reason: Optional[str] = None
    webhook_url: Optional[str] = Field(default=None, alias="webhookUrl")
    delivery: Optional[WebhookDelivery] = None
    context: Optional[Dict[str, Any]] = None


class BuildTxResult(BaseModel):
    to: str
    data: str
    value: str = "0"
    chain_id: int = Field(default=8453, alias="chainId")
    protocol: str
    action: str
    estimated_gas: Optional[str] = Field(default=None, alias="estimatedGas")
    description: str
