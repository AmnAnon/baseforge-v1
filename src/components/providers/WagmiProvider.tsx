// src/components/providers/WagmiProvider.tsx
// Client-only wrapper — keeps SSR layout free of client-only Wagmi context.
"use client";

import { WagmiProvider as WagmiProviderBase } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useState } from "react";

export default function WagmiProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per component tree — stable across re-renders.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProviderBase>
  );
}
