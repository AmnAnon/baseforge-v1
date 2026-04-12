// src/app/api/frame/route.tsx
// Farcaster Frame handler with miniapp (Frames v2) support.
// GET — initial frame; POST — decodes button click, returns new frame.
// Button 1 uses action: "app" to launch the miniapp in-app.
import { NextRequest, NextResponse } from "next/server";
import { logFrameInteraction, FrameLogPayload } from "@/lib/db/frame-analytics";

const BASE_URL =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

// ─── Frame State Encoding / Decoding ──────────────────────────────────────

interface FrameState {
  tab?: string;
}

function encodeFrameState(state: FrameState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeFrameState(raw: string | null): FrameState {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString()) as FrameState;
  } catch {
    return {};
  }
}

// Valid tabs — whitelist so we reject garbage button indices
const TABS = ["overview", "whales", "risk"] as const;
type TabType = (typeof TABS)[number];

function getTabForButton(index: number): TabType {
  return TABS[index - 1] ?? "overview";
}

// ─── HTML Frame Generator ────────────────────────────────────────────────

interface FrameButton {
  index: number;
  label: string;
  action?: string;
  target?: string;
}

interface FrameInput {
  text: string;
}

interface FrameParams {
  image: string;
  aspectRatio: string;
  buttons: FrameButton[];
  input?: FrameInput;
  state?: FrameState;
  appUrl?: string;
}

function buildFrame({ image, aspectRatio, buttons, input, state, appUrl }: FrameParams): NextResponse {
  const postUrl = `${BASE_URL}/api/frame`;
  const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const stateStr = state ? encodeFrameState(state) : "";

  let metaTags = `
    <meta property="fc:frame" content="v3" />
    <meta property="og:image" content="${encode(image)}" />
    <meta property="og:image:aspect_ratio" content="${encode(aspectRatio)}" />
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

  metaTags += `<meta property="fc:frame:post_url" content="${encode(postUrl)}" />`;

  if (appUrl) {
    metaTags += `\n    <meta property="fc:frame:app_url" content="${encode(appUrl)}" />`;
  }

  if (stateStr) {
    metaTags += `\n    <meta property="fc:frame:state" content="${encode(stateStr)}" />`;
  }

  const html = `<!DOCTYPE html><html><head>${metaTags}</head><body></body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

// ─── GET — Initial Frame ──────────────────────────────────────────────────

export async function GET() {
  return buildFrame({
    image: `${BASE_URL}/api/og`,
    aspectRatio: "1.91:1",
    input: { text: "Search protocols..." },
    appUrl: BASE_URL,
    buttons: [
      { index: 1, label: "Launch Dashboard", action: "app", target: BASE_URL },
      { index: 2, label: "Whales" },
      { index: 3, label: "Risk" },
    ],
  });
}

// ─── POST — Button click handler ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { untrustedData } = body;
    const buttonIndex = untrustedData?.buttonIndex || 1;

    const currentState = decodeFrameState(untrustedData?.state);

    // Extract analytics data from the Farcaster payload
    const castId = untrustedData?.castId || {};
    const analyticsPayload: FrameLogPayload = {
      fid: untrustedData?.fid,
      buttonIndex,
      action: untrustedData?.buttonAction,
      castFid: castId.fid,
      castHash: castId.hash,
      messageHash: untrustedData?.messageHash,
      address: untrustedData?.address,
      tab: currentState.tab,
      route: "/api/frame",
    };

    // Await analytics but with 300ms timeout inside the logger
    await logFrameInteraction(analyticsPayload);

    // Button 1 → launch miniapp via action: "app"
    if (buttonIndex === 1) {
      return buildFrame({
        image: `${BASE_URL}/api/og`,
        aspectRatio: "1.91:1",
        input: { text: "Search protocols..." },
        appUrl: BASE_URL,
        buttons: [
          { index: 1, label: "Open Dashboard", action: "app", target: BASE_URL },
          { index: 2, label: "Whales" },
          { index: 3, label: "Risk" },
        ],
        state: currentState,
      });
    }

    // Button 2 → Whales tab
    // Button 3 → Risk tab
    const newTab = getTabForButton(buttonIndex);
    const newState: FrameState = { tab: newTab };

    const tabImage = `${BASE_URL}/api/og?tab=${newTab}`;

    return buildFrame({
      image: tabImage,
      aspectRatio: "1.91:1",
      input: { text: `Viewing ${newTab} — search protocols...` },
      appUrl: BASE_URL,
      buttons: [
        { index: 1, label: "Open Dashboard", action: "app", target: BASE_URL },
        { index: 2, label: `Whales${newTab === "whales" ? "" : ""}` },
        { index: 3, label: `Risk${newTab === "risk" ? "" : ""}` },
      ],
      state: newState,
    });
  } catch (err) {
    console.error("Frame POST error:", err);
    return new NextResponse(`<!DOCTYPE html><html><body><h1>Frame Error</h1></body></html>`, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
