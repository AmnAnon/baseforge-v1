import { describe, expect, it } from "vitest";
import { canonicalProtocolId, normalizeEntityKey } from "./entity-resolver";

describe("protocol entity identifiers", () => {
  it("normalizes names, slugs and canonical identifiers consistently", () => {
    expect(normalizeEntityKey("Aerodrome Finance")).toBe("aerodromefinance");
    expect(normalizeEntityKey("aerodrome-finance")).toBe("aerodromefinance");
    expect(normalizeEntityKey("protocol:base:aerodrome-finance")).toBe("aerodromefinance");
  });

  it("creates stable network-scoped canonical IDs", () => {
    expect(canonicalProtocolId("aerodrome")).toBe("protocol:base:aerodrome");
  });
});
