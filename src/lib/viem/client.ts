// src/lib/viem/client.ts
// viem public RPC clients — read-only, no API key required.
// Uses multicall batching for efficient multi-balance queries.

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(),
  batch: { multicall: true },
});
