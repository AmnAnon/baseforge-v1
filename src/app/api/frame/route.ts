// src/app/api/frame/route.ts
// Farcaster Frame POST handler — processes button clicks
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("Frame POST payload:", JSON.stringify(body, null, 2));

    // Check which button was pressed
    const untrustedData = body?.untrustedData;
    const buttonIndex = untrustedData?.buttonIndex;

    const baseUrl = "http://localhost:3000";

    if (buttonIndex === 1) {
      // Button 1 "Launch Dashboard" — return updated frame with dashboard link
      return NextResponse.json({
        "fc:frame": "vNext",
        "fc:frame:image": `${baseUrl}/api/og?r=${Date.now()}`,
        "fc:frame:image:aspect_ratio": "1.91:1",
        "fc:frame:button:1": "Open App",
        "fc:frame:button:1:action": "link",
        "fc:frame:button:1:target": baseUrl,
        "fc:frame:button:2": "↻ Refresh",
        "fc:frame:post_url": `${baseUrl}/api/frame`,
      });
    }

    // Default — same frame
    return NextResponse.json({
      "fc:frame": "vNext",
      "fc:frame:image": `${baseUrl}/api/og?r=${Date.now()}`,
      "fc:frame:image:aspect_ratio": "1.91:1",
      "fc:frame:button:1": "Launch Dashboard",
      "fc:frame:post_url": `${baseUrl}/api/frame`,
      "fc:frame:button:2": "Visit App",
      "fc:frame:button:2:action": "link",
      "fc:frame:button:2:target": baseUrl,
    });
  } catch (err) {
    console.error("Frame handler error:", err);
    return NextResponse.json({ error: "Failed to process frame request" }, { status: 500 });
  }
}
