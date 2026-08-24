// mcp/src/server.js
// Lightweight, zero-dependency Model Context Protocol (MCP) Server for BaseForge.
// Implements MCP Stdio Transport for Claude Desktop, Cursor, Antigravity CLI, and AI Agents.

import * as readline from "node:readline";

const SERVER_NAME = "baseforge-mcp";
const SERVER_VERSION = "0.1.0";
const PROTOCOL_VERSION = "2024-11-05";

const BASE_URL = process.env.BASEFORGE_BASE_URL?.replace(/\/$/, "") || "https://baseforge-v1.vercel.app";
const API_KEY = process.env.BASEFORGE_API_KEY || "";

// ─── Tool Definitions ─────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_base_context",
    description:
      "Fetch real-time, compressed Base DeFi intelligence for AI agents (TVL, APYs, protocol health scores, whale flows, risk anomalies, and intent signals).",
    inputSchema: {
      type: "object",
      properties: {
        include: {
          type: "string",
          description:
            "Comma-separated sections to include: protocols, risk, market, whales, intent, lending, gas, mev (or 'all'). Defaults to 'protocols,risk,market,whales,intent'.",
          default: "protocols,risk,market,whales,intent",
        },
        protocol: {
          type: "string",
          description: "Optional protocol slug filter (e.g. 'aerodrome', 'uniswap-v3', 'seamless-protocol', 'moonwell', 'aave-v3', 'morpho-blue').",
        },
        timeframe: {
          type: "string",
          enum: ["1h", "6h", "24h"],
          description: "Analysis timeframe (default: '24h').",
          default: "24h",
        },
        top: {
          type: "integer",
          description: "Number of top protocols to evaluate by TVL (1-50, default: 10).",
          default: 10,
        },
        compact: {
          type: "boolean",
          description: "Strip verbose fields for ultra-low token usage (50% smaller payload).",
          default: false,
        },
      },
    },
  },
  {
    name: "get_whale_flows",
    description: "Fetch recent high-conviction on-chain whale transactions on Base ($50k+ DEX swaps, lending deposits/withdrawals, and liquidations).",
    inputSchema: {
      type: "object",
      properties: {
        min_usd: {
          type: "number",
          description: "Minimum USD value threshold for whale events (default: 50000).",
          default: 50000,
        },
        limit: {
          type: "integer",
          description: "Max number of whale flows to return (1-50, default: 15).",
          default: 15,
        },
        protocol: {
          type: "string",
          description: "Optional protocol slug filter (e.g. 'aerodrome', 'seamless-protocol').",
        },
      },
    },
  },
  {
    name: "get_protocol_risk",
    description: "Get security, oracle risk, and contract health breakdown for Base DeFi protocols.",
    inputSchema: {
      type: "object",
      properties: {
        protocol: {
          type: "string",
          description: "Specific protocol slug (e.g. 'aerodrome', 'moonwell', 'extra-finance').",
        },
      },
    },
  },
  {
    name: "build_defi_transaction",
    description: "Generate raw unsigned EVM transaction calldata for AI agent execution on Base (swaps, lending deposits, borrows).",
    inputSchema: {
      type: "object",
      required: ["action", "params"],
      properties: {
        action: {
          type: "string",
          enum: ["swap", "deposit", "borrow", "repay", "withdraw"],
          description: "Action type to execute.",
        },
        params: {
          type: "object",
          description: "Action-specific parameters: tokenIn, tokenOut, amountIn, protocol, pool.",
          properties: {
            tokenIn: { type: "string", description: "Input token symbol or address (e.g. 'ETH', 'USDC')" },
            tokenOut: { type: "string", description: "Output token symbol or address (e.g. 'USDC', 'AERO')" },
            amountIn: { type: "string", description: "Raw token amount in wei (e.g. '1000000000000000000')" },
            protocol: { type: "string", description: "Target protocol (e.g. 'aerodrome', 'uniswap-v3')" },
          },
          required: ["tokenIn", "tokenOut", "amountIn"],
        },
      },
    },
  },
  {
    name: "get_gas_oracle",
    description: "Get real-time Base L2 gas fee metrics, congestion level, and estimated transaction costs.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_agent_usage_stats",
    description: "Get live BaseForge API usage statistics, active API keys, daily request volumes, and agent client adoption.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── API Client Helper ────────────────────────────────────────────

async function fetchFromBaseForge(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "User-Agent": "BaseForge-MCP-Server/0.1.0",
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`BaseForge API responded with HTTP ${res.status}: ${errorText}`);
  }

  return res.json();
}

// ─── Tool Handlers ────────────────────────────────────────────────

async function handleToolCall(name, args) {
  switch (name) {
    case "get_base_context": {
      const params = new URLSearchParams();
      if (args.include) params.set("include", args.include);
      if (args.protocol) params.set("protocol", args.protocol);
      if (args.timeframe) params.set("timeframe", args.timeframe);
      if (args.top) params.set("top", String(args.top));
      if (args.compact) params.set("compact", "true");

      const qs = params.toString();
      const data = await fetchFromBaseForge(`/api/agents/context${qs ? `?${qs}` : ""}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    case "get_whale_flows": {
      const minUsd = args.min_usd || 50000;
      const limit = args.limit || 15;
      const params = new URLSearchParams({
        include: "whales",
        top: "5",
      });
      if (args.protocol) params.set("protocol", args.protocol);

      const data = await fetchFromBaseForge(`/api/agents/context?${params.toString()}`);
      const flows = (data.whales?.flows || [])
        .filter((f) => (f.usd ?? f.amountUSD ?? 0) >= minUsd)
        .slice(0, limit);

      const result = {
        count: flows.length,
        minUsd,
        summary: data.whales?.summary,
        flows,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "get_protocol_risk": {
      const params = new URLSearchParams({ include: "protocols,risk" });
      if (args.protocol) params.set("protocol", args.protocol);

      const data = await fetchFromBaseForge(`/api/agents/context?${params.toString()}`);
      const result = {
        marketRisk: data.risk,
        protocols: data.protocols,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case "build_defi_transaction": {
      const data = await fetchFromBaseForge("/api/agents/actions/build-tx", {
        method: "POST",
        body: JSON.stringify({ action: args.action, params: args.params }),
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    case "get_gas_oracle": {
      const data = await fetchFromBaseForge("/api/agents/context?include=gas");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.gas || { baseFeeGwei: 0.001, congestion: "low" }, null, 2),
          },
        ],
      };
    }

    case "get_agent_usage_stats": {
      const data = await fetchFromBaseForge("/api/agents/stats");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── JSON-RPC 2.0 Request Dispatcher ──────────────────────────────

async function handleMessage(request) {
  if (!request || typeof request !== "object") return;
  const { id, method, params } = request;

  // Notifications (no id)
  if (id === undefined || id === null) {
    if (method === "notifications/initialized") {
      // Client confirmed initialization
    }
    return;
  }

  try {
    switch (method) {
      case "initialize": {
        sendResponse(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        });
        break;
      }

      case "ping": {
        sendResponse(id, {});
        break;
      }

      case "tools/list": {
        sendResponse(id, { tools: TOOLS });
        break;
      }

      case "tools/call": {
        if (!params || !params.name) {
          sendError(id, -32602, "Invalid params: 'name' is required");
          return;
        }
        const toolResult = await handleToolCall(params.name, params.arguments || {});
        sendResponse(id, toolResult);
        break;
      }

      default:
        sendError(id, -32601, `Method not found: ${method}`);
        break;
    }
  } catch (err) {
    sendError(id, -32000, err instanceof Error ? err.message : String(err));
  }
}

function sendResponse(id, result) {
  const message = JSON.stringify({
    jsonrpc: "2.0",
    id,
    result,
  });
  process.stdout.write(`${message}\n`);
}

function sendError(id, code, message, data) {
  const errorObj = { code, message };
  if (data !== undefined) errorObj.data = data;
  const response = JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: errorObj,
  });
  process.stdout.write(`${response}\n`);
}

// ─── Stdio Line Reader ────────────────────────────────────────────

export function startMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      await handleMessage(parsed);
    } catch (err) {
      sendError(null, -32700, "Parse error: Invalid JSON");
    }
  });

  process.stderr.write(`[baseforge-mcp] Server running on stdio connected to ${BASE_URL}\n`);
}
