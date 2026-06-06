"use client";

// Wraps Wagmi + OnchainKit for swap/wallet surfaces (Phase 2).

import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "wagmi/chains";
import WagmiProvider from "@/components/providers/WagmiProvider";

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://baseforge-v1.vercel.app");

export default function OnchainKitAppProvider({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

  return (
    <WagmiProvider>
      <OnchainKitProvider
        apiKey={apiKey}
        chain={base}
        config={{
          appearance: {
            name: "BaseForge",
            logo: `${baseUrl}/icon.png`,
            mode: "dark",
            theme: "default",
          },
        }}
      >
        {children}
      </OnchainKitProvider>
    </WagmiProvider>
  );
}