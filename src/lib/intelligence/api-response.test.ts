import { describe, expect, it } from "vitest";
import { apiErrorFromResponse } from "./api-response";

describe("versioned API middleware errors", () => {
  it("preserves error codes and quota headers in the standard envelope", async () => {
    const response = new Response(JSON.stringify({
      error: "Daily quota exceeded",
      quota: 1000,
      retryAfter: 120,
      tier: "free",
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "120",
        "X-Quota-Limit": "1000",
        "X-Quota-Remaining": "0",
      },
    });

    const result = await apiErrorFromResponse(response, new Request("https://example.test/api/v1/usage"));
    const body = await result.json();

    expect(result.status).toBe(429);
    expect(body.error.code).toBe("daily_quota_exceeded");
    expect(body.error.quota).toBe(1000);
    expect(body.meta.apiVersion).toBe("1.0.0");
    expect(result.headers.get("Retry-After")).toBe("120");
    expect(result.headers.get("X-Quota-Remaining")).toBe("0");
  });
});
