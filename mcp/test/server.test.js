import assert from "node:assert/strict";
import { test } from "node:test";
import { handleResourceRead, handleToolCall, RESOURCES, TOOLS } from "../src/server.js";

test("MCP discovery tools are registered", () => {
  const names = TOOLS.map((tool) => tool.name);
  assert.ok(names.includes("get_api_capabilities"));
  assert.ok(names.includes("get_data_catalog"));
  assert.ok(names.includes("get_metric_definitions"));
  assert.ok(names.includes("search_protocols"));
  assert.ok(names.includes("get_protocol_context"));
  assert.ok(names.includes("get_my_api_usage"));
});

test("MCP resources expose the discovery catalog", () => {
  assert.deepEqual(
    RESOURCES.map((resource) => resource.uri),
    ["baseforge://capabilities", "baseforge://catalog", "baseforge://metrics", "baseforge://usage"],
  );
});

test("protocol context tool calls the versioned context API", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody;
  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ data: { entity: { id: "protocol:base:test" } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await handleToolCall("get_protocol_context", {
      entity_id: "test",
      include: ["overview", "risk"],
    });
    assert.match(requestedUrl, /\/api\/v1\/context\/query$/);
    assert.equal(requestBody.entity.id, "test");
    assert.deepEqual(requestBody.include, ["overview", "risk"]);
    assert.match(result.content[0].text, /protocol:base:test/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resource reads return the metric catalog", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { metrics: [{ id: "tvl_usd" }] } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    const result = await handleResourceRead("baseforge://metrics");
    assert.equal(result.contents[0].mimeType, "application/json");
    assert.match(result.contents[0].text, /tvl_usd/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("API usage tool calls the authenticated per-key usage endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ data: { usage: { requests24h: 12 } }, meta: { apiVersion: "1.0.0" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await handleToolCall("get_my_api_usage", {});
    assert.match(requestedUrl, /\/api\/v1\/usage$/);
    assert.match(result.content[0].text, /requests24h/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
