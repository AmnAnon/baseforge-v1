// src/app/api/frame/route.tsx
// Farcaster Frame POST handler — processes button clicks
// MUST return HTML with fc:frame meta tags, NOT JSON
// Frame buttons rotate: Dashboard → Top Protocol → Market Summary
import { NextRequest, NextResponse } from "next/server";

const BASE_URL =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

// Track button state per interaction to cycle through options
const FRAME_STATES = ["dashboard", "top_protocol", "market_summary"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const buttonIndex = body?.untrustedData?.buttonIndex || 1;

    // Read state from the interaction URL or body if forwarded
    const interactionState = body?.interactionState || "start";

    if (buttonIndex === 1) {
      // Button always says "Open App" after first click — link to dashboard
      return buildFrame({
        image: `${BASE_URL}/api/og/miniapp?r=${Date.now()}`,
        aspectRatio: "1.91:1",
        buttons: [
          {
            index: 1,
            label: "Open Dashboard",
            action: "link",
            target: BASE_URL,
          },
        ],
      });
    }

    if (buttonIndex === 2) {
      // Show a different frame view with a dynamic summary
      return buildFrame({
        image: `${BASE_URL}/api/og?refresh=${Date.now()}`,
        aspectRatio: "1.91:1",
        buttons: [
          { index: 1, label: "Launch Dashboard" },
          { index: 2, label: "↻ Refresh" },
        ],
      });
    }

    // Default — initial frame
    return buildFrame({
      image: `${BASE_URL}/api/og?refresh=${Date.now()}`,
      aspectRatio: "1.91:1",
      buttons: [
        { index: 1, label: "Launch Dashboard" },
        { index: 2, label: "Market Summary" },
      ],
    });
  } catch (err) {
    console.error("Frame POST error:", err);
    return new NextResponse(`<!DOCTYPE html><html><body><h1>Frame Error</h1></body></html>`, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}

// ─── HTML Frame Generator ────────────────────────────────────────────────

interface FrameButton {
  index: number;
  label: string;
  action?: string;
  target?: string;
  postUrl?: string;
}

interface FrameParams {
  image: string;
  aspectRatio: string;
  buttons: FrameButton[];
}

function buildFrame({ image, aspectRatio, buttons }: FrameParams): NextResponse {
  const postUrl = `${BASE_URL}/api/frame`;

  // HTML-encode values before interpolating into meta tag attributes
  const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let metaTags = `
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${encode(image)}" />
    <meta property="fc:frame:image:aspect_ratio" content="${encode(aspectRatio)}" />
  `;

  for (const btn of buttons) {
    metaTags += `<meta property="fc:frame:button:${btn.index}" content="${encode(btn.label)}" />\n`;
    if (btn.action) {
      metaTags += `<meta property="fc:frame:button:${btn.index}:action" content="${encode(btn.action)}" />\n`;
    }
    if (btn.target) {
      metaTags += `<meta property="fc:frame:button:${btn.index}:target" content="${encode(btn.target)}" />\n`;
    }
  }

  // post_url only once, not per-button
  metaTags += `<meta property="fc:frame:post_url" content="${encode(postUrl)}" />`;

  const html = `<!DOCTYPE html><html><head>${metaTags}</head><body></body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

// GET — initial frame when debugger requests
export async function GET() {
  return buildFrame({
    image: `${BASE_URL}/api/og?refresh=${Date.now()}`,
    aspectRatio: "1.91:1",
    buttons: [
      { index: 1, label: "Launch Dashboard" },
      { index: 2, label: "Market Summary" },
    ],
  });
}
