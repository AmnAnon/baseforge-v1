// src/lib/wagmi.ts
// Wagmi v2 + Base chain — builder code attribution via dataSuffix when configured.

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask } from "wagmi/connectors";
import { getBuilderDataSuffix } from "@/lib/builder-code";

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://baseforge-v1.vercel.app");

const dataSuffix = getBuilderDataSuffix();

export const wagmiConfig = createConfig({
  chains: [base],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectors: [
    injected() as any,
    metaMask() as any,
    coinbaseWallet({
      appName: "BaseForge",
      appLogoUrl: `${baseUrl}/icon.png`,
    }) as any,
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
  ...(dataSuffix ? { dataSuffix } : {}),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}