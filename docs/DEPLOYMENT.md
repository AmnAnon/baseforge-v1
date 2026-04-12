# Deployment Guide — Base App + Farcaster

> **Updated April 12, 2026** — Reflects the April 9, 2026 Base App changes. Base App now treats all apps as standard web apps. Farcaster manifests are optional for Warpcast discovery but no longer required for Base App.

## Overview

BaseForge can be deployed as:

1. **Base App** (primary) — Standard web app registered on Base.dev, discovered via the Base App wallet
2. **Farcaster Mini App** (optional) — Frame v3 with `accountAssociation` for Warpcast discovery

Both paths share the same codebase. The difference is metadata and auth.

```
┌─────────────────────────────────────────────────┐
│              BaseForge Web App                  │
│         (Next.js on Vercel/Docker)              │
├─────────────────┬───────────────────────────────┤
│   Base App      │   Farcaster (optional)        │
│                 │                               │
│  Base.dev       │  /.well-known/farcaster.json  │
│  registration   │  /api/frame (v3)              │
│  SIWE auth      │  accountAssociation signing   │
│  wagmi + viem   │  Warpcast discovery           │
│  Builder code   │  Neynar webhooks              │
└─────────────────┴───────────────────────────────┘
```

---

## Path 1: Base App Deployment (Recommended)

### Step 1 — Deploy to Vercel

```bash
# Option A: One-click
# Click "Deploy to Vercel" in the README

# Option B: Manual
git clone https://github.com/AmnAnon/baseforge.git
cd baseforge
npm install
```

Set environment variables on Vercel:

| Variable | Required | Value |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | Auto | Your deployment URL |
| `ETHERSCAN_API_KEY` | Yes | [etherscan.io/myapikey](https://etherscan.io/myapikey) |
| `DATABASE_URL` | Yes | [console.neon.tech](https://console.neon.tech) |
| `ENVIO_API_TOKEN` | Yes | Your Envio HyperSync token |
| `NEXT_PUBLIC_DEMO_MODE` | Optional | `true` for demo banner |

Deploy. Verify at `https://your-app.vercel.app/api/health`.

### Step 2 — Register on Base.dev

1. Go to [base.dev](https://www.base.dev)
2. Create a new project
3. Complete app metadata:

| Field | Value |
|---|---|
| **Name** | BaseForge Analytics |
| **Icon** | Upload `public/icon.png` (200×200) |
| **Tagline** | AI-Ready Intelligence Layer for Base DeFi |
| **Description** | Real-time DeFi analytics for the Base blockchain. Track TVL, protocol health, whale movements, risk scores. AI agent API included. |
| **Screenshots** | Upload `public/preview.png` + mobile screenshots |
| **Category** | Finance / DeFi |
| **Primary URL** | `https://your-app.vercel.app` |
| **Builder Code** | Your builder code ([docs](https://docs.base.org/base-chain/builder-codes/builder-codes)) |

> Already registered apps do not need to re-register or update metadata.

### Step 3 — Add SIWE Authentication

BaseForge needs SIWE (Sign-In with Ethereum) for wallet-based auth in the Base App. This replaces the old Farcaster SDK auth.

Install dependencies:

```bash
npm install wagmi viem @tanstack/react-query @base-org/account
```

Create a wagmi config for Base:

```typescript
// src/lib/wagmi-config.ts
import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    baseAccount({ appName: "BaseForge Analytics" }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(),
  },
});
```

Add SIWE sign-in component:

```typescript
// src/components/SiweSignIn.tsx
"use client";

import { useState } from "react";
import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";

export function SiweSignIn() {
  const { address, chainId, isConnected } = useAccount();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();

  async function handleSignIn() {
    if (!isConnected || !address || !chainId || !publicClient) return;
    setIsSigningIn(true);

    try {
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce: generateSiweNonce(),
        uri: window.location.origin,
        version: "1",
      });
      const signature = await signMessageAsync({ message });
      const valid = await publicClient.verifySiweMessage({ message, signature });
      if (!valid) throw new Error("SIWE verification failed");
      // → create session, set cookie, etc.
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <button onClick={handleSignIn} disabled={!isConnected || isSigningIn}>
      {isSigningIn ? "Signing in..." : "Sign in with Ethereum"}
    </button>
  );
}
```

### Step 4 — Pre-flight Check

Before submitting to Base.dev, verify:

- [ ] App loads in a mobile browser with connected wallet (no Farcaster context)
- [ ] SIWE auth works (wallet signature + verification)
- [ ] `https://your-app.vercel.app/api/health` returns `status: "ok"`
- [ ] `https://your-app.vercel.app/api/agents/context?include=all&top=3` returns data
- [ ] No Farcaster SDK dependencies (wagmi/viem replaces them)

---

## Path 2: Farcaster Mini App (Optional)

> The Farcaster manifest is no longer required for Base App, but it enables discovery in **Warpcast** and other Farcaster clients. If you only care about Base App, skip this section.

### Step 1 — Verify Existing Frame Setup

BaseForge already has:
- `/.well-known/farcaster.json` — dynamic manifest route
- `/api/frame` — Frame v3 handler with miniapp launch
- `/api/og` — dynamic OG images for frame sharing
- `requiredChains: ["eip155:8453"]` — Base chain requirement

### Step 2 — Generate accountAssociation

The `accountAssociation` field in `farcaster.json` proves domain ownership. It's currently empty — you need to sign it with your Farcaster custody key.

**Option A: Using the Farcaster Hub CLI**

```bash
# Install the Farcaster Hub CLI
npm install -g @farcaster/hub-cli

# Generate the association (replace with your FID and domain)
farcaster-hub sign-domain \
  --fid YOUR_FID \
  --domain your-app.vercel.app \
  --custody-key YOUR_CUSTODY_PRIVATE_KEY
```

This outputs `header`, `payload`, and `signature` values.

**Option B: Using Warpcast Developer Tools**

1. Go to [warpcast.com/~/developers](https://warpcast.com/~/developers)
2. Navigate to "Domain Verification"
3. Enter your domain
4. Sign with your connected Farcaster account
5. Copy the generated `accountAssociation` object

### Step 3 — Add the Signature

Set environment variables (recommended over hardcoding):

```bash
# .env.local or Vercel env vars
FC_ACCOUNT_HEADER=eyJmaW...
FC_ACCOUNT_PAYLOAD=eyJkb21...
FC_ACCOUNT_SIGNATURE=MHg2Y...
```

Update the manifest route to read from env:

```typescript
// In src/app/.well-known/farcaster.json/route.ts
const manifest = {
  accountAssociation: {
    header: process.env.FC_ACCOUNT_HEADER || "",
    payload: process.env.FC_ACCOUNT_PAYLOAD || "",
    signature: process.env.FC_ACCOUNT_SIGNATURE || "",
  },
  // ... rest of manifest
};
```

### Step 4 — Validate in Warpcast

1. Open [warpcast.com/~/developers/frames](https://warpcast.com/~/developers/frames)
2. Enter your URL: `https://your-app.vercel.app`
3. Verify:
   - Frame loads with correct OG image
   - "Launch Dashboard" button works
   - `accountAssociation` validates (green checkmark)

### Step 5 — Submit to Warpcast Directory

Once validated, submit your mini app for Warpcast discovery through the developer portal.

---

## What Changed on April 9, 2026

| Before (Farcaster Mini App) | After (Base App) |
|---|---|
| `/.well-known/farcaster.json` required | App metadata on Base.dev |
| Farcaster SDK for auth | wagmi + viem + SIWE |
| FID-based identity | Wallet address identity |
| Neynar webhooks for notifications | Base.dev notifications API *(coming soon)* |
| Discovery via Farcaster | Discovery via Base.dev + builder codes |
| `accountAssociation` required | Optional (only for Warpcast discovery) |

### What BaseForge already has (no changes needed)

- ✅ Standard web app (Next.js, works in any browser)
- ✅ No Farcaster SDK dependency in the main app
- ✅ viem already used (portfolio, balances)
- ✅ Dynamic OG images
- ✅ Works on mobile viewports
- ✅ `requiredChains: ["eip155:8453"]`

### What to add for full Base App compliance

- 🔲 wagmi provider wrapper (WagmiProvider + QueryClientProvider)
- 🔲 SIWE sign-in component for authenticated features (alerts, portfolio)
- 🔲 Base.dev project registration
- 🔲 Builder code

### What to add for Warpcast (optional)

- 🔲 `accountAssociation` signature in `farcaster.json`
- 🔲 `FC_BOT_MNEMONIC` for authenticated frame interactions

---

## Environment Variable Reference (Deployment)

| Variable | Base App | Farcaster | Description |
|---|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | Required | Required | Your production URL |
| `ETHERSCAN_API_KEY` | Required | Required | Etherscan V2 fallback |
| `DATABASE_URL` | Required | Required | Neon Postgres |
| `ENVIO_API_TOKEN` | Required | Required | Primary indexer |
| `NEXT_PUBLIC_DEMO_MODE` | Optional | Optional | Show demo banner |
| `FC_ACCOUNT_HEADER` | — | Required | accountAssociation header |
| `FC_ACCOUNT_PAYLOAD` | — | Required | accountAssociation payload |
| `FC_ACCOUNT_SIGNATURE` | — | Required | accountAssociation signature |
| `FC_BOT_MNEMONIC` | — | Optional | Frame interaction auth |
| `ADMIN_KEY` | Optional | Optional | Admin analytics gate |

---

## Quick Reference

```bash
# Deploy to Vercel
vercel --prod

# Test health
curl https://your-app.vercel.app/api/health | jq .status

# Test agent API
curl "https://your-app.vercel.app/api/agents/context?include=all&top=3" | jq

# Test Farcaster manifest
curl https://your-app.vercel.app/.well-known/farcaster.json | jq

# Validate frame (in Warpcast)
# → https://warpcast.com/~/developers/frames
```
