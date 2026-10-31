import { describe, expect, it } from "vitest";
import {
  API_BASE_PATH,
  API_VERSION,
  CAPABILITIES,
  DATASET_CATALOG,
  METRIC_CATALOG,
  NETWORK_CATALOG,
  OPENAPI_DOCUMENT,
} from "./api-registry";

describe("BaseForge API discovery registry", () => {
  it("publishes a semantic API version and versioned base path", () => {
    expect(API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(API_BASE_PATH).toBe("/api/v1");
  });

  it("keeps capability and operation identifiers unique", () => {
    const capabilityIds = CAPABILITIES.map((item) => item.id);
    const operationIds = CAPABILITIES.flatMap((item) => item.operations.map((operation) => operation.id));

    expect(new Set(capabilityIds).size).toBe(capabilityIds.length);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("documents supported networks and data domains", () => {
    expect(NETWORK_CATALOG.some((network) => network.id === "base" && network.chainId === 8453)).toBe(true);
    expect(DATASET_CATALOG.length).toBeGreaterThan(0);
  });

  it("gives every metric a unit, source, calculation and limitations", () => {
    expect(METRIC_CATALOG.length).toBeGreaterThan(0);
    for (const metric of METRIC_CATALOG) {
      expect(metric.id).toBeTruthy();
      expect(metric.unit).toBeTruthy();
      expect(metric.source).toBeTruthy();
      expect(metric.calculation).toBeTruthy();
      expect(metric.limitations.length).toBeGreaterThan(0);
    }
  });

  it("exposes discovery endpoints in its OpenAPI document", () => {
    expect(OPENAPI_DOCUMENT.openapi).toBe("3.1.0");
    expect(Object.keys(OPENAPI_DOCUMENT.paths)).toEqual(
      expect.arrayContaining([
        "/api/v1",
        "/api/v1/capabilities",
        "/api/v1/catalog",
        "/api/v1/metrics",
        "/api/v1/openapi.json",
      ]),
    );
  });
});
