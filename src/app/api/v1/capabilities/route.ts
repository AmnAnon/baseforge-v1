import { apiSuccess } from "@/lib/intelligence/api-response";
import { API_BASE_PATH, CAPABILITIES } from "@/lib/intelligence/api-registry";

export const dynamic = "force-static";

export function GET(request: Request) {
  return apiSuccess({
    capabilities: CAPABILITIES,
    operationCount: CAPABILITIES.reduce((count, capability) => count + capability.operations.length, 0),
    conventions: {
      basePath: API_BASE_PATH,
      authentication: "Operations marked optional_api_key accept public access and may support higher limits with X-API-Key.",
      errors: "Legacy operations may retain endpoint-specific error shapes; the versioned discovery surface uses data/meta envelopes.",
      units: "Metric units and caveats are defined in /api/v1/metrics.",
    },
  }, request);
}
