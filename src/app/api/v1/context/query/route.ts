import { NextResponse } from "next/server";
import { z } from "zod";
import { apiKeyMiddleware } from "@/lib/api-key";
import { rateLimiterMiddleware } from "@/lib/rate-limit";
import { apiSuccess } from "@/lib/intelligence/api-response";
import { buildProtocolContext, type ProtocolContextSection } from "@/lib/intelligence/context-builder";
import { resolveProtocolEntity } from "@/lib/intelligence/entity-resolver";

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

  try {
    const rawBody: unknown = await request.json();
    const parsed = QuerySchema.safeParse(rawBody);
    if (!parsed.success) {
      const response = NextResponse.json({
        error: {
          code: "invalid_context_query",
          message: parsed.error.issues.map((issue) => issue.message).join("; "),
        },
      }, { status: 400 });
      auth.trackUsage(400, Date.now() - startedAt, request);
      return response;
    }

    const query = parsed.data;
    const lookup = query.entity.id || query.entity.name || "";
    const resolution = await resolveProtocolEntity(lookup);

    if (resolution.status === "not_found") {
      const response = NextResponse.json({
        error: { code: "entity_not_found", message: "No supported Base protocol matched the supplied identifier." },
        query: { entity: query.entity },
      }, { status: 404 });
      auth.trackUsage(404, Date.now() - startedAt, request);
      return response;
    }

    if (resolution.status === "ambiguous") {
      const response = NextResponse.json({
        error: { code: "ambiguous_entity", message: "The supplied name matched multiple protocols. Use a canonical entity ID or slug." },
        candidates: resolution.candidates,
      }, { status: 409 });
      auth.trackUsage(409, Date.now() - startedAt, request);
      return response;
    }

    const sections = await buildProtocolContext(
      resolution.entity,
      query.include as ProtocolContextSection[],
    );
    const response = apiSuccess({
      ...sections,
      resolution: {
        strategy: resolution.entity.match,
        canonicalId: resolution.entity.id,
      },
    }, request);
    auth.trackUsage(200, Date.now() - startedAt, request);
    return response;
  } catch (error) {
    const response = NextResponse.json({
      error: {
        code: "context_query_failed",
        message: error instanceof Error ? error.message : "Unable to build context.",
      },
    }, { status: 502 });
    auth.trackUsage(502, Date.now() - startedAt, request);
    return response;
  }
}
