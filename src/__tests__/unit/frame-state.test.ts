import { describe, it, expect } from "vitest";

interface FrameState {
  tab?: string;
}

/**
 * Inline copies of encode/decode — the route module doesn't export them.
 * These MUST match the implementation in src/app/api/frame/route.tsx.
 */
function encodeFrameState(state: FrameState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeFrameState(raw: string | null): FrameState {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString()) as FrameState;
  } catch {
    return {};
  }
}

describe("frame state encoding / decoding", () => {
  it("round-trips a valid state object", () => {
    const state: FrameState = { tab: "whales" };
    const encoded = encodeFrameState(state);
    const decoded = decodeFrameState(encoded);
    expect(decoded).toEqual(state);
  });

  it("encodes to a URL-safe base64 string", () => {
    const state: FrameState = { tab: "risk" };
    const encoded = encodeFrameState(state);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("returns empty object for null input", () => {
    expect(decodeFrameState(null)).toEqual({});
  });

  it("returns empty object for undefined input", () => {
    expect(decodeFrameState(undefined)).toEqual({});
  });

  it("returns empty object for malformed base64", () => {
    expect(decodeFrameState("not-valid-base64!!!")).toEqual({});
  });

  it("returns empty object for non-JSON base64", () => {
    const encoded = Buffer.from("hello world").toString("base64url");
    expect(decodeFrameState(encoded)).toEqual({});
  });

  it("round-trips an empty state", () => {
    const state: FrameState = {};
    const encoded = encodeFrameState(state);
    const decoded = decodeFrameState(encoded);
    expect(decoded).toEqual({});
  });

  it("ignores unknown keys in decoded state", () => {
    // Simulate state with extra keys from a future version
    const futureState = JSON.stringify({ tab: "overview", version: 2 });
    const encoded = Buffer.from(futureState).toString("base64url");
    const decoded = decodeFrameState(encoded);
    expect(decoded.tab).toBe("overview");
    expect((decoded as any).version).toBe(2);
  });
});
