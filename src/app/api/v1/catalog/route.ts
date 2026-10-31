import { apiSuccess } from "@/lib/intelligence/api-response";
import { DATASET_CATALOG, NETWORK_CATALOG } from "@/lib/intelligence/api-registry";

export const dynamic = "force-static";

export function GET(request: Request) {
  return apiSuccess({
    networks: NETWORK_CATALOG,
    datasets: DATASET_CATALOG,
    discovery: {
      protocolDirectory: "/api/protocols",
      protocolDetail: "/api/protocols/{slug}",
      note: "The protocol directory is dynamic provider data. Query the linked endpoint for the current protocol set.",
    },
  }, request);
}
