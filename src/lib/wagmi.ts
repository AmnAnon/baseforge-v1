// src/lib/wagmi.ts
// Wagmi v3 configuration — Base chain, injected wallet connectors.

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected, coinbaseWallet, metaMask } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: "BaseForge Analytics",
      appLogoUrl: "https://baseforge.app/logo.png",
    }),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});
