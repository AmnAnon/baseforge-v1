import { apiSuccess } from "@/lib/intelligence/api-response";
import { METRIC_CATALOG } from "@/lib/intelligence/api-registry";

export const dynamic = "force-static";

export function GET(request: Request) {
  return apiSuccess({
    metrics: METRIC_CATALOG,
    count: METRIC_CATALOG.length,
    interpretationRules: [
      "A missing or null metric is not equivalent to zero.",
      "Provider-reported, derived and estimated values must remain distinguishable.",
      "Risk and health scores are heuristic indicators, not guarantees or investment advice.",
      "Use the source and limitations attached to each metric when comparing values.",
    ],
  }, request);
}
