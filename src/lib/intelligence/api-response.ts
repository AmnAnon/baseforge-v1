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

function responseHeaders(meta: ApiResponseMeta) {
  return {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    "X-API-Version": API_VERSION,
    "X-Request-Id": meta.requestId,
  };
}

export function apiSuccess<T>(data: T, request?: Request, status = 200) {
  const meta = responseMeta(request);
  return NextResponse.json({ data, meta }, { status, headers: responseHeaders(meta) });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  request?: Request,
  details?: Record<string, unknown>,
) {
  const meta = responseMeta(request);
  return NextResponse.json(
    { error: { code, message, ...details }, meta },
    { status, headers: responseHeaders(meta) },
  );
}
