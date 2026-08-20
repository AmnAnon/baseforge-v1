"""
BaseForge Agent Framework Tool Integrations
Drop-in tool adapters for LangChain, CrewAI, AutoGen, and OpenAI Tool Calling.
"""

from typing import Dict, Any, List, Optional
import json
from .client import BaseForgeClient


def get_baseforge_openai_tools() -> List[Dict[str, Any]]:
    """
    Returns OpenAI / Anthropic function calling definitions for BaseForge.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": "get_base_defi_context",
                "description": "Fetch real-time on-chain DeFi intelligence for Base network including TVL, yields, risk scores, whale flows, and intent signals.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "include": {
                            "type": "string",
                            "description": "Comma-separated sections: protocols, risk, market, whales, intent, lending, gas, mev (or 'all')",
                            "default": "protocols,risk,market,whales,intent",
                        },
                        "protocol": {
                            "type": "string",
                            "description": "Optional protocol slug filter (e.g. 'aerodrome', 'uniswap-v3', 'seamless-protocol', 'moonwell', 'aave-v3')",
                        },
                        "timeframe": {
                            "type": "string",
                            "enum": ["1h", "6h", "24h"],
                            "default": "24h",
                        },
                        "top": {
                            "type": "integer",
                            "description": "Number of top protocols to evaluate (1-50)",
                            "default": 10,
                        },
                        "compact": {
                            "type": "boolean",
                            "description": "Whether to return ultra-compact payload to conserve LLM tokens",
                            "default": False,
                        },
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "build_base_defi_transaction",
                "description": "Generate unsigned EVM transaction calldata to execute a swap, deposit, or borrow on Base DeFi protocols.",
                "parameters": {
                    "type": "object",
                    "required": ["action", "params"],
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["swap", "deposit", "borrow", "repay", "withdraw"],
                        },
                        "params": {
                            "type": "object",
                            "description": "Action specific parameters (tokenIn, tokenOut, amountIn, protocol, pool)",
                        },
                    },
                },
            },
        },
    ]


class BaseForgeLangChainTool:
    """
    LangChain StructuredTool wrapper for BaseForge AI Agent Context.
    """
    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://baseforge-v1.vercel.app"):
        self.client = BaseForgeClient(api_key=api_key, base_url=base_url)

    def run(
        self,
        include: str = "protocols,risk,market,whales,intent",
        protocol: Optional[str] = None,
        timeframe: str = "24h",
        top: int = 10,
        compact: bool = False,
    ) -> str:
        ctx = self.client.get_context(
            include=include,
            protocol=protocol,
            timeframe=timeframe,
            top=top,
            compact=compact,
        )
        return ctx.model_dump_json(by_alias=True)
