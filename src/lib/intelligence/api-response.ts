import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { API_VERSION } from "./api-registry";

export interface ApiResponseMeta {
  apiVersion: string;
  generatedAt: string;
  requestId: string;
}

function responseMeta(request?: Request): ApiResponseMeta {
  return {
    apiVersion: API_VERSION,
    generatedAt: new Date().toISOString(),
    requestId: request?.headers.get("x-request-id")?.slice(0, 128) || randomUUID(),
  };
}

function responseHeaders(meta: ApiResponseMeta, extraHeaders?: Record<string, string>) {
  return {
    "Cache-Control": "no-store",
    "X-API-Version": API_VERSION,
    "X-Request-Id": meta.requestId,
    ...extraHeaders,
  };
}

export function apiSuccess<T>(data: T, request?: Request, status = 200, extraHeaders?: Record<string, string>) {
  const meta = responseMeta(request);
  return NextResponse.json({ data, meta }, { status, headers: responseHeaders(meta, extraHeaders) });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  request?: Request,
  details?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
) {
  const meta = responseMeta(request);
  return NextResponse.json(
    { error: { code, message, ...details }, meta },
    { status, headers: responseHeaders(meta, extraHeaders) },
  );
}


export async function apiErrorFromResponse(response: Response, request?: Request) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const rawError = payload.error;
  const errorObject = rawError && typeof rawError === "object"
    ? rawError as Record<string, unknown>
    : undefined;
  const rawCode = typeof rawError === "string" ? rawError : errorObject?.code;
  const code = typeof rawCode === "string"
    ? rawCode.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    : "request_denied";
  const rawMessage = payload.detail || payload.message || errorObject?.message || rawError;
  const message = typeof rawMessage === "string" ? rawMessage : "The request was denied.";
  const details = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !["error", "detail", "message"].includes(key)),
  );
  const forwardedHeaders: Record<string, string> = {};
  for (const name of [
    "Retry-After",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "X-Quota-Limit",
    "X-Quota-Remaining",
    "X-Quota-Reset",
  ]) {
    const value = response.headers.get(name);
    if (value) forwardedHeaders[name] = value;
  }
  return apiError(code, message, response.status, request, details, forwardedHeaders);
}
