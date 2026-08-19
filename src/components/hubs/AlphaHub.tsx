"use client";

// src/components/hubs/AlphaHub.tsx
// Unified Alpha & Whales Cockpit — Smart Money Signals, Whale Flow Feed, & MEV Radar.

import { useState } from "react";
import HubSubNav from "@/components/navigation/HubSubNav";
import SmartMoneyHub from "@/components/hubs/SmartMoneyHub";
import WhalesSection from "@/components/sections/WhalesSection";
import MEVSection from "@/components/sections/MEVSection";

export default function AlphaHub() {
  const [sub, setSub] = useState("signals");

  return (
    <div className="space-y-4">
      <HubSubNav
        ariaLabel="Alpha and Whales sections"
        tabs={[
          { id: "signals", label: "⚡ Whale Signals & Copy-Trade" },
          { id: "feed", label: "🐋 Live Whale Feed" },
          { id: "mev", label: "⚡ MEV Radar" },
        ]}
        active={sub}
        onChange={setSub}
      />

      {sub === "signals" && <SmartMoneyHub />}
      {sub === "feed" && <WhalesSection />}
      {sub === "mev" && <MEVSection />}
    </div>
  );
}
