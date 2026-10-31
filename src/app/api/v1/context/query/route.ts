import { apiError, apiSuccess } from "@/lib/intelligence/api-response";
import { apiKeyMiddleware } from "@/lib/api-key";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { buildProtocolContext, type ProtocolContextSection } from "@/lib/intelligence/context-builder";
import { resolveProtocolEntity } from "@/lib/intelligence/entity-resolver";
import { logger } from "@/lib/logger";
import { z } from "zod";

const QuerySchema = z.object({
  entity: z.object({
    type: z.literal("protocol"),
    id: z.string().min(1).max(160).optional(),
    name: z.string().min(1).max(120).optional(),
    network: z.literal("base").default("base"),
  }).refine((entity) => Boolean(entity.id || entity.name), {
    message: "Provide entity.id or entity.name",
  }),
  include: z.array(z.enum(["overview", "tvl", "risk", "whales"])).min(1).max(4)
    .default(["overview", "tvl", "risk"]),
}).strict();

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const rateResponse = await rateLimiterMiddleware()(request);
  if (rateResponse) return rateResponse;

  const auth = await apiKeyMiddleware(request, { required: false, endpoint: "v1-context-query" });
  if (auth.response) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    auth.trackUsage(400, Date.now() - startedAt, request);
    return apiError("invalid_json", "Request body must be valid JSON.", 400, request);
  }

  const parsed = QuerySchema.safeParse(rawBody);
  if (!parsed.success) {
    auth.trackUsage(400, Date.now() - startedAt, request);
    return apiError(
      "invalid_context_query",
      parsed.error.issues.map((issue) => issue.message).join("; "),
      400,
      request,
    );
  }

  try {
    const query = parsed.data;
    const lookup = query.entity.id || query.entity.name || "";
    const resolution = await resolveProtocolEntity(lookup);

    if (resolution.status === "not_found") {
      auth.trackUsage(404, Date.now() - startedAt, request);
      return apiError(
        "entity_not_found",
        "No supported Base protocol matched the supplied identifier.",
        404,
        request,
        { query: { entity: query.entity } },
      );
    }

    if (resolution.status === "ambiguous") {
      auth.trackUsage(409, Date.now() - startedAt, request);
      return apiError(
        "ambiguous_entity",
        "The supplied name matched multiple protocols. Use a canonical entity ID or slug.",
        409,
        request,
        { candidates: resolution.candidates },
      );
    }

    const context = await buildProtocolContext(
      resolution.entity,
      query.include as ProtocolContextSection[],
    );
    const response = apiSuccess({
      ...context,
      resolution: {
        strategy: resolution.entity.match,
        canonicalId: resolution.entity.id,
      },
    }, request);
    auth.trackUsage(200, Date.now() - startedAt, request);
    return response;
  } catch (error) {
    logger.error("Versioned agent context query failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    auth.trackUsage(502, Date.now() - startedAt, request);
    return apiError(
      "context_query_failed",
      "BaseForge could not assemble the requested context. Retry later or reduce the requested sections.",
      502,
      request,
    );
  }
}
