"use client";

// src/components/hubs/DeveloperHub.tsx
// Developer Portal — Interactive SDK docs, code snippets, & API Key management.

import { useState } from "react";
import { Terminal, Code, Cpu, Key, Copy, Check, ExternalLink, Sparkles, BookOpen, Shield, Zap } from "lucide-react";
import { NeonCard } from "@/components/ui/NeonCard";

const TS_EXAMPLE = `import { BaseForgeClient } from "@baseforge/sdk";

// Initialize BaseForge client
const baseforge = new BaseForgeClient({ apiKey: "bf_live_your_key_here" });

async function runAgent() {
  // 1. Ingest LLM-compressed Base intelligence context
  const context = await baseforge.getContext({ include: "all", top: 10 });
  console.log("Base Ecosystem TVL:", context.market.totalTvl);

  // 2. Fetch real-time Smart Money whale signals
  const { signals } = await baseforge.getWhaleSignals();
  console.log("Top Whale Move:", signals[0].tokenSymbol, signals[0].signalType);

  // 3. Build raw unsigned EVM transaction calldata for execution
  const tx = await baseforge.buildTransaction({
    action: "swap",
    params: {
      tokenIn: "ETH",
      tokenOut: "USDC",
      amountIn: "1000000000000000000",
      protocol: "uniswap-v3"
    }
  });

  console.log("Unsigned Transaction Calldata:", tx.transaction.data);
}

runAgent();`;

const PYTHON_EXAMPLE = `import requests

BASE_URL = "https://baseforge-v1.vercel.app"
HEADERS = {"X-API-Key": "bf_live_your_key_here"}

# 1. Fetch AI Agent Context
context = requests.get(f"{BASE_URL}/api/agents/context?include=all&top=10", headers=HEADERS).json()
print("Market State:", context["market"])

# 2. Fetch Real-time Memecoin Launches & RugCheck Scores
launches = requests.get(f"{BASE_URL}/api/tokens/launches?minSafety=80", headers=HEADERS).json()
print("Safe Token Launches:", len(launches["launches"]))

# 3. Generate EVM Calldata for Execution
tx_payload = {
    "action": "swap",
    "params": {
        "tokenIn": "ETH",
        "tokenOut": "USDC",
        "amountIn": "1000000000000000000",
        "protocol": "uniswap-v3"
    }
}
tx = requests.post(f"{BASE_URL}/api/agents/actions/build-tx", json=tx_payload, headers=HEADERS).json()
print("EVM Calldata:", tx["transaction"]["data"])`;

const CURL_EXAMPLE = `# Fetch compressed ecosystem state for LLM ingestion
curl "https://baseforge-v1.vercel.app/api/agents/context?include=all&top=5"

# Build unsigned swap calldata for AI Agent execution
curl -X POST "https://baseforge-v1.vercel.app/api/agents/actions/build-tx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "swap",
    "params": {
      "tokenIn": "ETH",
      "tokenOut": "USDC",
      "amountIn": "1000000000000000000",
      "protocol": "uniswap-v3"
    }
  }'`;

export default function DeveloperHub() {
  const [activeTab, setActiveTab] = useState<"ts" | "python" | "curl">("ts");
  const [copied, setCopied] = useState(false);

  const getCodeSnippet = () => {
    if (activeTab === "ts") return TS_EXAMPLE;
    if (activeTab === "python") return PYTHON_EXAMPLE;
    return CURL_EXAMPLE;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="rounded-2xl border border-[#00d4ff]/30 bg-gradient-to-r from-black/80 via-[#0a1128]/70 to-black/80 p-5 sm:p-6 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-xs font-semibold text-[var(--bf-neon-primary)]">
              <Terminal size={14} className="animate-pulse" />
              <span>Developer & Agent Portal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              BaseForge SDK & Action API
              <Sparkles size={18} className="text-amber-400" />
            </h2>
            <p className="text-xs sm:text-sm text-[var(--bf-text-secondary)]">
              Plug compressed Base intelligence & EVM action transaction building into your AI agents (ElizaOS, LangChain, AutoGPT) in 3 lines of code.
            </p>
          </div>

          <a
            href="/api/agents/examples"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-[#00d4ff]/20 to-[#7b61ff]/20 border border-[#00d4ff]/40 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 hover:from-[#00d4ff]/30 hover:to-[#7b61ff]/30 transition-all shrink-0"
          >
            <span>OpenAPI & Examples</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Feature Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <Cpu size={14} className="text-[var(--bf-neon-primary)]" />
            <span>LLM-Compressed Feeds</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Zap size={14} className="text-amber-400" />
            <span>EVM Calldata Builder</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Shield size={14} className="text-emerald-400" />
            <span>RugCheck Safety Engine</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Key size={14} className="text-purple-400" />
            <span>20 Req/Min Free Tier</span>
          </div>
        </div>
      </div>

      {/* Code Snippets Section */}
      <NeonCard glowColor="rgba(0,212,255,0.06)" className="!p-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Code size={18} className="text-[var(--bf-neon-primary)]" />
              <h3 className="font-bold text-white text-base">Quickstart SDK Snippets</h3>
            </div>

            {/* Language tabs */}
            <div className="flex items-center gap-2 bg-black/60 p-1 rounded-xl border border-white/10 text-xs">
              {[
                { id: "ts", label: "TypeScript / Node.js" },
                { id: "python", label: "Python" },
                { id: "curl", label: "cURL CLI" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-all font-mono font-medium ${
                    activeTab === tab.id
                      ? "bg-[var(--bf-neon-primary)] text-black font-bold shadow-md"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Code Container */}
          <div className="relative rounded-xl border border-white/10 bg-black/80 p-4 font-mono text-xs text-gray-300 overflow-x-auto">
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>

            <pre className="leading-relaxed">
              <code>{getCodeSnippet()}</code>
            </pre>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}
