import { NextResponse } from "next/server";
import { OPENAPI_DOCUMENT } from "@/lib/intelligence/api-registry";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(OPENAPI_DOCUMENT, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Content-Type": "application/json",
    },
  });
}
