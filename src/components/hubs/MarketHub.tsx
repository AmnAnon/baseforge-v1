"use client";

import { useState } from "react";
import { Bot, ExternalLink } from "lucide-react";
import HubSubNav from "@/components/navigation/HubSubNav";
import MarketSection from "@/components/sections/MarketSection";
import RevenueDashboard from "@/components/sections/RevenueDashboard";

export default function MarketHub() {
  const [sub, setSub] = useState("prices");

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-[var(--bf-text-secondary)]">
          Extended market data &amp; protocol fees
        </p>
        <a
          href="/api/agents/context?include=all&top=5"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--bf-neon-accent)] hover:text-[var(--bf-neon-primary)] shrink-0"
        >
          <Bot className="h-3.5 w-3.5" />
          Agent API
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <HubSubNav
        ariaLabel="Market sections"
        tabs={[
          { id: "prices", label: "Prices" },
          { id: "revenue", label: "Revenue" },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "prices" ? <MarketSection /> : <RevenueDashboard />}
    </div>
  );
}