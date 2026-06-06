import { describe, it, expect } from "vitest";
import { getProtocolSurface, resolveProtocolSlug, BASE_CONTRACTS } from "@/lib/contracts";

describe("protocol surfaces", () => {
  it("resolves aerodrome slug aliases", () => {
    expect(resolveProtocolSlug("aerodrome")).toBe("aerodrome-finance");
    expect(getProtocolSurface("aerodrome-finance")?.name).toBe("Aerodrome");
  });

  it("returns swap actions for uniswap", () => {
    const surface = getProtocolSurface("uniswap-v3");
    expect(surface?.actions.some((a) => a.type === "swap")).toBe(true);
  });

  it("returns deposit actions for seamless", () => {
    const surface = getProtocolSurface("seamless-protocol");
    expect(surface?.actions.some((a) => a.type === "deposit")).toBe(true);
  });

  it("returns null for unknown protocols", () => {
    expect(getProtocolSurface("random-protocol-xyz")).toBeNull();
  });

  it("exports Base USDC address", () => {
    expect(BASE_CONTRACTS.USDC).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});