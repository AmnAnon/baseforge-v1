import { apiSuccess } from "@/lib/intelligence/api-response";
import { API_BASE_PATH, API_VERSION } from "@/lib/intelligence/api-registry";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return apiSuccess({
    name: "BaseForge API",
    version: API_VERSION,
    description: "Machine-readable discovery surface for Base ecosystem intelligence.",
    documentation: "https://github.com/AmnAnon/baseforge-v1/tree/main/docs",
    links: {
      capabilities: `${API_BASE_PATH}/capabilities`,
      catalog: `${API_BASE_PATH}/catalog`,
      metrics: `${API_BASE_PATH}/metrics`,
      openapi: `${API_BASE_PATH}/openapi.json`,
      legacyAgentContext: "/api/agents/context",
    },
    compatibility: {
      versioning: "New versioned API contracts are published under /api/v1.",
      legacyRoutes: "Existing /api routes remain available and are not silently changed by this discovery release.",
    },
  }, request);
}
