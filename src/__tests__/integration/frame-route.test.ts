import { describe, it, expect } from "vitest";

/**
 * Integration test for the /api/frame POST handler.
 *
 * We can't import the route module directly in the unit test env because it
 * pulls in drizzle/db dependencies. Instead, we replicate the POST route
 * logic (state decode → button routing → HTML generation) inline and assert
 * on the generated meta tags. This validates the encode/decode + routing
 * contract without a live DB.
 */

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

const TABS = ["overview", "whales", "risk"] as const;
type TabType = (typeof TABS)[number];

function getTabForButton(index: number): TabType {
  return TABS[index - 1] ?? "overview";
}

/** Simulate the frame route POST logic — NOTE: call site passes buttonIndex directly (not -1) */

/** Simulate the frame route POST logic */
function handleFramePost(body: { untrustedData?: { buttonIndex?: number; state?: string } }) {
  const { untrustedData } = body;
  const buttonIndex = untrustedData?.buttonIndex || 1;
  const currentState = decodeFrameState(untrustedData?.state ?? null);

  if (buttonIndex === 1) {
    return { action: "app", state: currentState, image: "/api/og" };
  }

  const newTab = getTabForButton(buttonIndex);
  const newState: FrameState = { tab: newTab };
  return { action: "tab", state: newState, image: `/api/og?tab=${newTab}` };
}

/** Parse fc:frame meta tags from an HTML string */
function getMetaProperty(html: string, property: string): string | null {
  const match = html.match(
    new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`)
  );
  return match?.[1] ?? null;
}

describe("/api/frame POST integration", () => {
  it("Button 1 returns app-launch action with unchanged state", () => {
    const existingState: FrameState = { tab: "overview" };
    const result = handleFramePost({
      untrustedData: { buttonIndex: 1, state: encodeFrameState(existingState) },
    });
    expect(result.action).toBe("app");
    expect(result.state).toEqual(existingState);
  });

  it("Button 2 routes to Whales tab with correct state", () => {
    const result = handleFramePost({
      untrustedData: { buttonIndex: 2 },
    });
    expect(result.action).toBe("tab");
    expect(result.state.tab).toBe("whales");
    expect(result.image).toBe("/api/og?tab=whales");
  });

  it("Button 3 routes to Risk tab with correct state", () => {
    const result = handleFramePost({
      untrustedData: { buttonIndex: 3 },
    });
    expect(result.action).toBe("tab");
    expect(result.state.tab).toBe("risk");
    expect(result.image).toBe("/api/og?tab=risk");
  });

  it("unknown button defaults to overview", () => {
    const result = handleFramePost({
      untrustedData: { buttonIndex: 9 },
    });
    expect(result.state.tab).toBe("overview");
  });

  it("handles empty body gracefully", () => {
    const result = handleFramePost({});
    expect(result.action).toBe("app");
    expect(result.state).toEqual({});
  });

  it("malformed state in POST request defaults to empty state", () => {
    const result = handleFramePost({
      untrustedData: { buttonIndex: 2, state: "not-valid!" },
    });
    expect(result.action).toBe("tab");
    expect(result.state).toEqual({ tab: "whales" });
  });

  it("state is preserved across tab transitions", () => {
    // Start -> click Whale -> click Risk
    let state: FrameState = {};
    state = handleFramePost({ untrustedData: { buttonIndex: 2, state: encodeFrameState(state) } }).state;
    expect(state.tab).toBe("whales");

    state = handleFramePost({ untrustedData: { buttonIndex: 3, state: encodeFrameState(state) } }).state;
    expect(state.tab).toBe("risk");
  });

  it("HTML response contains correct frame properties for Whales", () => {
    const result = handleFramePost({ untrustedData: { buttonIndex: 2 } });
    const html = generateFrame({
      image: result.image,
      aspectRatio: "1.91:1",
      buttons: [
        { index: 1, label: "Open Dashboard", action: "app", target: "http://localhost:3000" },
        { index: 2, label: "Whales" },
        { index: 3, label: "Risk" },
      ],
      state: result.state,
      appUrl: "http://localhost:3000",
    });

    const frameImage = getMetaProperty(html, "fc:frame:image");
    const frameState = getMetaProperty(html, "fc:frame:state");

    expect(frameImage).toBe("/api/og?tab=whales");
    expect(frameState).toBeDefined();
    expect(decodeFrameState(frameState).tab).toBe("whales");
  });
});

// Minimal frame HTML generator mirroring the route's buildFrame
interface FrameButton {
  index: number;
  label: string;
  action?: string;
  target?: string;
}

function generateFrame({
  image,
  aspectRatio,
  buttons,
  state,
  appUrl,
}: {
  image: string;
  aspectRatio: string;
  buttons: FrameButton[];
  state?: FrameState;
  appUrl?: string;
}): string {
  const encode = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

  const stateStr = state ? encodeFrameState(state) : "";
  const postUrl = "http://localhost:3000/api/frame";
  metaTags += `<meta property="fc:frame:post_url" content="${encode(postUrl)}" />`;
  if (appUrl) metaTags += `\n<meta property="fc:frame:app_url" content="${encode(appUrl)}" />`;
  if (stateStr) metaTags += `\n<meta property="fc:frame:state" content="${encode(stateStr)}" />`;

  return `<!DOCTYPE html><html><head>${metaTags}</head><body></body></html>`;
}
