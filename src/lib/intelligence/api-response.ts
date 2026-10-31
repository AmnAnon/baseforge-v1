import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { API_VERSION } from "./api-registry";

export interface ApiResponseMeta {
  apiVersion: string;
  generatedAt: string;
  requestId: string;
}

export function apiSuccess<T>(data: T, request?: Request, status = 200) {
  const requestId = request?.headers.get("x-request-id")?.slice(0, 128) || randomUUID();
  const meta: ApiResponseMeta = {
    apiVersion: API_VERSION,
    generatedAt: new Date().toISOString(),
    requestId,
  };

  return NextResponse.json(
    { data, meta },
    {
      status,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-API-Version": API_VERSION,
        "X-Request-Id": requestId,
      },
    },
  );
}
