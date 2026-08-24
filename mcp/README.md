# BaseForge Model Context Protocol (MCP) Server ⚡

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for **BaseForge** — Plug real-time Base Network DeFi intelligence, whale flows, risk metrics, and transaction builders directly into **Claude Desktop**, **Cursor**, **Antigravity CLI**, and autonomous AI agents.

---

## 🛠️ Tools Exposed

1. **`get_base_context`**: Query real-time, LLM-compressed intelligence for Base DeFi (TVL, APYs, protocols, risk scores, whale flows, intent signals).
2. **`get_whale_flows`**: High-conviction on-chain whale activity on Base ($50k+ swaps, deposits, liquidations).
3. **`get_protocol_risk`**: Protocol security breakdown, oracle diversity, and smart contract health scores (0-100).
4. **`build_defi_transaction`**: Generate unsigned raw EVM transactions (calldata) for DEX swaps and lending operations.
5. **`get_gas_oracle`**: Real-time Base L2 base fee, congestion levels, and estimated execution costs.
6. **`get_agent_usage_stats`**: Live BaseForge API key adoption and daily request metrics.

---

## 🚀 Quick Setup

### 1. Claude Desktop Setup

Add the following to your `claude_desktop_config.json`:

* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
* **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "baseforge": {
      "command": "npx",
      "args": ["-y", "@baseforge/mcp"],
      "env": {
        "BASEFORGE_BASE_URL": "https://baseforge-v1.vercel.app",
        "BASEFORGE_API_KEY": "optional_api_key_for_higher_rate_limits"
      }
    }
  }
}
```

---

### 2. Cursor IDE Setup

In your project root, add `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "baseforge": {
      "command": "node",
      "args": ["/path/to/baseforge-v1/mcp/bin/baseforge-mcp.js"],
      "env": {
        "BASEFORGE_BASE_URL": "https://baseforge-v1.vercel.app"
      }
    }
  }
}
```

---

### 3. Antigravity / Gemini CLI Setup

Add to `~/.gemini/antigravity-cli/mcp_config.json`:

```json
{
  "mcpServers": {
    "baseforge": {
      "command": "node",
      "args": ["/root/baseforge-v1/mcp/bin/baseforge-mcp.js"]
    }
  }
}
```

---

### 4. Running Standalone for Testing

You can run the MCP server interactively via stdio:

```bash
node mcp/bin/baseforge-mcp.js
```

Or test tool listing using JSON-RPC:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node mcp/bin/baseforge-mcp.js
```
