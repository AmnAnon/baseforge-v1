import { describe, expect, it, vi } from "vitest";
import { BaseForgeClient } from "./index";

describe("BaseForge TypeScript SDK", () => {
  it("queries the versioned context API and preserves the envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { entity: { id: "protocol:base:test" }, sections: { tvl: { value: 123 } } },
      meta: { apiVersion: "1.0.0", generatedAt: "2026-10-31T00:00:00.000Z", requestId: "req-test" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new BaseForgeClient({ fetch: fetcher as typeof fetch, apiKey: "test-key" });

    const result = await client.getProtocolContext({
      entity: { type: "protocol", id: "test" },
      include: ["tvl"],
    });

    expect(result.data.entity.id).toBe("protocol:base:test");
    expect(result.meta.requestId).toBe("req-test");
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/api/v1/context/query" }),
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
  });

  it("surfaces structured API errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "entity_not_found", message: "Not found" },
    }), { status: 404, headers: { "content-type": "application/json" } }));
    const client = new BaseForgeClient({ fetch: fetcher as typeof fetch });

    await expect(client.getProtocolContext({
      entity: { type: "protocol", id: "missing" },
    })).rejects.toMatchObject({ status: 404, code: "entity_not_found" });
  });

  it("rejects context queries without an entity identifier", () => {
    const client = new BaseForgeClient({ fetch: vi.fn() as typeof fetch });
    expect(() => client.getProtocolContext({ entity: { type: "protocol" } })).toThrow(TypeError);
  });
});
