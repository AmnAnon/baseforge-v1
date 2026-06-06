// src/lib/builder-code.ts
// ERC-8021 builder attribution for Base (base.dev Builder Code).

import { Attribution } from "ox/erc8021";
import type { Hex } from "viem";

/** Builder code from base.dev → Settings → Builder Code (e.g. bc_xxx). */
export function getBuilderCode(): string | undefined {
  const code = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE?.trim();
  return code || undefined;
}

/** Calldata suffix appended to outbound transactions when configured. */
export function getBuilderDataSuffix(): Hex | undefined {
  const code = getBuilderCode();
  if (!code) return undefined;
  try {
    return Attribution.toDataSuffix({ codes: [code] });
  } catch {
    return undefined;
  }
}