"use client";

import { useState } from "react";
import HubSubNav from "@/components/navigation/HubSubNav";
import RiskSection from "@/components/sections/RiskSection";
import ProtocolCompareSection from "@/components/sections/ProtocolCompareSection";
import AlertsSection from "@/components/sections/AlertsSection";

export default function RiskHub() {
  const [sub, setSub] = useState("scores");

  return (
    <div>
      <HubSubNav
        ariaLabel="Risk sections"
        tabs={[
          { id: "scores", label: "Scores" },
          { id: "compare", label: "Compare" },
          { id: "alerts", label: "Alerts" },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "scores" && <RiskSection />}
      {sub === "compare" && <ProtocolCompareSection />}
      {sub === "alerts" && <AlertsSection />}
    </div>
  );
}