"use client";

import { useState } from "react";
import HubSubNav from "@/components/navigation/HubSubNav";
import WhalesSection from "@/components/sections/WhalesSection";
import MEVSection from "@/components/sections/MEVSection";

export default function FlowsHub() {
  const [sub, setSub] = useState("whales");

  return (
    <div>
      <HubSubNav
        ariaLabel="Flows sections"
        tabs={[
          { id: "whales", label: "Whales" },
          { id: "mev", label: "MEV" },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "whales" ? <WhalesSection /> : <MEVSection />}
    </div>
  );
}