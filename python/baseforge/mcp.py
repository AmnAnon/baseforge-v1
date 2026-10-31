"""
BaseForge Model Context Protocol (MCP) Server (Python)
Stdio-based MCP server enabling Claude, Cursor, and Python AI Agents to access Base DeFi intelligence.
"""

import sys
import json
import asyncio
from typing import Dict, Any, Optional
from .client import BaseForgeClient

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "baseforge-mcp-python"
SERVER_VERSION = "0.2.0"

TOOLS = [
    {
        "name": "get_base_context",
        "description": "Fetch real-time, compressed Base DeFi intelligence for AI agents (TVL, APYs, protocol health scores, whale flows, risk anomalies, and intent signals).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "include": {
                    "type": "string",
                    "description": "Comma-separated sections: protocols, risk, market, whales, intent, lending, gas, mev (or 'all').",
                    "default": "protocols,risk,market,whales,intent",
                },
                "protocol": {"type": "string", "description": "Optional protocol slug filter."},
                "timeframe": {"type": "string", "enum": ["1h", "6h", "24h"], "default": "24h"},
                "top": {"type": "integer", "description": "Number of top protocols (1-50)", "default": 10},
                "compact": {"type": "boolean", "description": "Compress payload to conserve tokens", "default": False},
            },
        },
    },
    {
        "name": "get_whale_flows",
        "description": "Fetch recent high-conviction whale moves on Base ($50k+ swaps, deposits, liquidations).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "min_usd": {"type": "number", "default": 50000},
                "limit": {"type": "integer", "default": 15},
                "protocol": {"type": "string"},
            },
        },
    },
    {
        "name": "get_protocol_risk",
        "description": "Get security, oracle risk, and contract health score (0-100) for Base protocols.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "protocol": {"type": "string"},
            },
        },
    },
    {
        "name": "build_defi_transaction",
        "description": "Generate unsigned EVM transaction calldata for Base DeFi actions (swaps, deposits, borrows).",
        "inputSchema": {
            "type": "object",
            "required": ["action", "params"],
            "properties": {
                "action": {"type": "string", "enum": ["swap", "deposit", "borrow", "repay", "withdraw"]},
                "params": {"type": "object"},
            },
        },
    },
    {
        "name": "get_gas_oracle",
        "description": "Get real-time Base L2 base fee, congestion, and estimated transaction costs.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_agent_usage_stats",
        "description": "Get live BaseForge API key adoption and daily request metrics.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]

TOOLS.extend([
    {
        "name": "get_api_capabilities",
        "description": "Discover BaseForge API capabilities, operations, access requirements and data domains.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_data_catalog",
        "description": "List supported networks and BaseForge data domains.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_metric_definitions",
        "description": "Explain metric units, sources, calculation methods and limitations.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_protocol_context",
        "description": "Resolve a Base protocol and assemble overview, TVL, risk and optional whale context.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "entity_id": {"type": "string"},
                "entity_name": {"type": "string"},
                "include": {"type": "array", "items": {"type": "string", "enum": ["overview", "tvl", "risk", "whales"]}},
            },
            "anyOf": [{"required": ["entity_id"]}, {"required": ["entity_name"]}],
        },
    },
    {
        "name": "search_protocols",
        "description": "Search the current Base protocol directory by name, slug or category.",
        "inputSchema": {
            "type": "object",
            "required": ["query"],
            "properties": {"query": {"type": "string", "minLength": 1}, "limit": {"type": "integer", "default": 10}},
        },
    },
])

RESOURCES = [
    {"uri": "baseforge://capabilities", "name": "BaseForge API capabilities", "description": "Registered API operations and access requirements.", "mimeType": "application/json"},
    {"uri": "baseforge://catalog", "name": "BaseForge data catalog", "description": "Supported networks and data domains.", "mimeType": "application/json"},
    {"uri": "baseforge://metrics", "name": "BaseForge metric dictionary", "description": "Metric definitions, units, sources and limitations.", "mimeType": "application/json"},
]


def send_response(req_id: Any, result: Dict[str, Any]):
    msg = json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result})
    sys.stdout.write(f"{msg}\n")
    sys.stdout.flush()


def send_error(req_id: Any, code: int, message: str):
    msg = json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}})
    sys.stdout.write(f"{msg}\n")
    sys.stdout.flush()


def handle_tool_call(client: BaseForgeClient, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    if name == "get_base_context":
        ctx = client.get_context(
            include=args.get("include", "protocols,risk,market,whales,intent"),
            protocol=args.get("protocol"),
            timeframe=args.get("timeframe", "24h"),
            top=args.get("top", 10),
            compact=args.get("compact", False),
        )
        return {"content": [{"type": "text", "text": ctx.model_dump_json(by_alias=True, indent=2)}]}

    elif name == "get_whale_flows":
        flows = client.get_whale_flows(
            min_usd=args.get("min_usd", 50000),
            limit=args.get("limit", 15),
        )
        return {"content": [{"type": "text", "text": json.dumps([f.model_dump(by_alias=True) for f in flows], indent=2)}]}

    elif name == "get_protocol_risk":
        risk = client.get_risk()
        return {"content": [{"type": "text", "text": json.dumps(risk.model_dump(by_alias=True) if risk else {}, indent=2)}]}

    elif name == "build_defi_transaction":
        tx = client.build_transaction(
            action=args.get("action", "swap"),
            params=args.get("params", {}),
        )
        return {"content": [{"type": "text", "text": tx.model_dump_json(by_alias=True, indent=2)}]}

    elif name == "get_gas_oracle":
        ctx = client.get_context(include="gas")
        gas = ctx.gas.model_dump(by_alias=True) if ctx.gas else {"baseFeeGwei": 0.001, "congestion": "low"}
        return {"content": [{"type": "text", "text": json.dumps(gas, indent=2)}]}

    elif name == "get_agent_usage_stats":
        overview = client.get_market_overview()
        return {"content": [{"type": "text", "text": json.dumps(overview.model_dump(by_alias=True) if overview else {}, indent=2)}]}

    elif name == "get_api_capabilities":
        return {"content": [{"type": "text", "text": json.dumps(client.get_capabilities(), indent=2)}]}

    elif name == "get_data_catalog":
        return {"content": [{"type": "text", "text": json.dumps(client.get_data_catalog(), indent=2)}]}

    elif name == "get_metric_definitions":
        return {"content": [{"type": "text", "text": json.dumps(client.get_metric_definitions(), indent=2)}]}

    elif name == "get_protocol_context":
        context = client.get_protocol_context(
            entity_id=args.get("entity_id"),
            entity_name=args.get("entity_name"),
            include=args.get("include"),
        )
        return {"content": [{"type": "text", "text": json.dumps(context, indent=2)}]}

    elif name == "search_protocols":
        query = str(args.get("query", "")).strip().lower()
        limit = max(1, min(50, int(args.get("limit", 10))))
        protocols = client.get_top_protocols(top=50)
        matches = [
            protocol.model_dump(by_alias=True)
            for protocol in protocols
            if query in (protocol.name or "").lower()
            or query in protocol.id.lower()
            or query in (protocol.cat or "").lower()
        ][:limit]
        return {"content": [{"type": "text", "text": json.dumps({"query": query, "count": len(matches), "protocols": matches}, indent=2)}]}

    else:
        raise ValueError(f"Unknown tool: {name}")


def main():
    client = BaseForgeClient()
    sys.stderr.write(f"[baseforge-mcp-python] Server running on stdio\n")
    sys.stderr.flush()

    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except Exception:
            send_error(None, -32700, "Parse error")
            continue

        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        if req_id is None:
            continue

        try:
            if method == "initialize":
                send_response(
                    req_id,
                    {
                        "protocolVersion": PROTOCOL_VERSION,
                        "capabilities": {
                            "tools": {"listChanged": False},
                            "resources": {"listChanged": False},
                        },
                        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                    },
                )
            elif method == "ping":
                send_response(req_id, {})
            elif method == "tools/list":
                send_response(req_id, {"tools": TOOLS})
            elif method == "resources/list":
                send_response(req_id, {"resources": RESOURCES})
            elif method == "resources/read":
                uri = params.get("uri")
                readers = {
                    "baseforge://capabilities": client.get_capabilities,
                    "baseforge://catalog": client.get_data_catalog,
                    "baseforge://metrics": client.get_metric_definitions,
                }
                if uri not in readers:
                    send_error(req_id, -32602, f"Unknown resource URI: {uri}")
                    continue
                value = readers[uri]()
                send_response(req_id, {"contents": [{"uri": uri, "mimeType": "application/json", "text": json.dumps(value, indent=2)}]})
            elif method == "tools/call":
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})
                res = handle_tool_call(client, tool_name, tool_args)
                send_response(req_id, res)
            else:
                send_error(req_id, -32601, f"Method not found: {method}")
        except Exception as e:
            send_error(req_id, -32000, str(e))


if __name__ == "__main__":
    main()
