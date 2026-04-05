// src/app/api/frame/route.tsx
// Farcaster Frame POST handler — processes button clicks
// MUST return HTML with fc:frame meta tags, NOT JSON
// Frame flow: Initial → Refresh → Top Protocol → Back
import { NextRequest, NextResponse } from "next/server";

const BASE_URL =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const buttonIndex = body?.untrustedData?.buttonIndex || 1;

    if (buttonIndex === 1) {
      // First button: "Launch Dashboard" — returns miniapp frame with "Open Dashboard" link
      return buildFrame({
        image: `${BASE_URL}/api/og?_t=${Date.now()}`,
        aspectRatio: "1.91:1",
        input: { text: "Search protocols..." },
        buttons: [
          { index: 1, label: "Open Dashboard", action: "link", target: BASE_URL },
          { index: 2, label: "↻ Refresh" },
        ],
      });
    }

    if (buttonIndex === 2) {
      // Refresh — same view, new image
      return buildFrame({
        image: `${BASE_URL}/api/og?_t=${Date.now()}`,
        aspectRatio: "1.91:1",
        input: { text: "Search protocols..." },
        buttons: [
          { index: 1, label: "Open Dashboard", action: "link", target: BASE_URL },
          { index: 2, label: "↻ Refresh" },
        ],
      });
    }

    // Default — initial state
    return buildFrame({
      image: `${BASE_URL}/api/og?_t=${Date.now()}`,
      aspectRatio: "1.91:1",
      input: { text: "Search protocols..." },
      buttons: [
        { index: 1, label: "Launch Dashboard" },
        { index: 2, label: "↻ Refresh" },
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

interface FrameInput {
  text: string;
  label?: string;
}

interface FrameParams {
  image: string;
  aspectRatio: string;
  buttons: FrameButton[];
  input?: FrameInput;
}

function buildFrame({ image, aspectRatio, buttons, input }: FrameParams): NextResponse {
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

  if (input) {
    metaTags += `<meta property="fc:frame:input:text" content="${encode(input.text)}" />\n`;
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
    image: `${BASE_URL}/api/og`,
    aspectRatio: "1.91:1",
    input: { text: "Search protocols..." },
    buttons: [
      { index: 1, label: "Launch Dashboard" },
      { index: 2, label: "↻ Refresh" },
    ],
  });
}
