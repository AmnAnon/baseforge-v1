import { describe, it, expect } from "vitest";
import { validateWebhookUrlSync } from "@/lib/webhook-url";

describe("validateWebhookUrlSync", () => {
  it("allows public https URLs", () => {
    const result = validateWebhookUrlSync("https://hooks.example.com/alerts");
    expect(result.ok).toBe(true);
  });

  it("rejects http", () => {
    const result = validateWebhookUrlSync("http://hooks.example.com/alerts");
    expect(result.ok).toBe(false);
  });

  it("rejects localhost", () => {
    const result = validateWebhookUrlSync("https://localhost/hook");
    expect(result.ok).toBe(false);
  });

  it("rejects private IPv4 literals", () => {
    const result = validateWebhookUrlSync("https://192.168.1.1/hook");
    expect(result.ok).toBe(false);
  });

  it("rejects metadata hosts", () => {
    const result = validateWebhookUrlSync("https://metadata.google.internal/computeMetadata/v1/");
    expect(result.ok).toBe(false);
  });
});