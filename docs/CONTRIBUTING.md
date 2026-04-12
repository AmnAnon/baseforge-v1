# Contributing to BaseForge

Thank you for considering contributing to BaseForge. This document covers how to set up your development environment, our code conventions, and how to submit changes.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/baseforge.git
   cd baseforge
   ```
3. Install dependencies: `npm install`
4. Set up environment: `cp .env.example .env.local` (see [Setup Guide](./SETUP.md))
5. Create a feature branch: `git checkout -b feat/my-feature`

## Development Workflow

### Before you code

- Check [existing issues](https://github.com/AmnAnon/baseforge/issues) to avoid duplicate work
- For large changes, open an issue first to discuss the approach
- Read the [Architecture](./ARCHITECTURE.md) doc to understand the system

### While coding

Run the dev server and tests in parallel:

```bash
npm run dev           # Dev server on :3000
npm run test:watch    # Tests in watch mode
```

### Before submitting

Run the full check suite:

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript
npm run test          # All tests
npm run build         # Production build
```

All four must pass. The CI pipeline runs these automatically on PRs.

---

## Code Conventions

### TypeScript

- **Strict mode** is enabled. No `any` unless absolutely necessary (add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why).
- **Zod validation** for all external data (API responses, user input, indexer data).
- **Types over interfaces** for union types and utility types. Interfaces for objects with methods.
- **No `as` casts** unless the type system can't express the constraint.

### File Organization

- **API routes:** `src/app/api/<resource>/route.ts` — one resource per directory
- **Components:** `src/components/sections/` for dashboard tabs, `src/components/ui/` for primitives
- **Libraries:** `src/lib/` for shared logic — cache, logger, validation, etc.
- **Tests:** `src/__tests__/` mirroring the structure (unit, integration, e2e)

### Naming

- **Files:** kebab-case for most files (`rate-limit.ts`), PascalCase for React components (`DemoBanner.tsx`)
- **Functions:** camelCase (`getWhaleFlows`, `calculateHealthScore`)
- **Constants:** UPPER_SNAKE for true constants (`CACHE_TTL`, `EVENT_SIGNATURES`), camelCase for config objects
- **Types:** PascalCase (`SwapEvent`, `ProtocolData`)

### API Routes

Every API route should:
1. Apply rate limiting at the top
2. Check cache before external calls
3. Validate response data with Zod
4. Return consistent shapes (never return non-200 for data endpoints)
5. Include `X-Cache-Status` and `X-Data-Source` headers
6. Handle errors gracefully — return empty data with `isStale: true` rather than 500

```typescript
export async function GET(req: Request) {
  // 1. Rate limit
  const rateResponse = await rateLimiterMiddleware()(req);
  if (rateResponse) return rateResponse;

  try {
    // 2. Cache
    const data = await cache.getWithStaleFallback("key", TTL, async () => {
      // 3. Fetch + validate
      const raw = await fetch("...");
      return validateOrFallback(Schema, raw, EMPTY, "label");
    });

    // 4. Consistent response
    return NextResponse.json(data, {
      headers: { "X-Cache-Status": "HIT", "X-Data-Source": "source" }
    });
  } catch {
    // 5. Graceful error
    return NextResponse.json({ ...EMPTY(), isStale: true }, { status: 200 });
  }
}
```

### CSS / Styling

- **Tailwind CSS 4** for all styling. No CSS modules or styled-components.
- **Dark theme only** — black/gray-900 backgrounds, emerald/blue accents.
- **Consistent border radius:** `rounded-2xl` for cards, `rounded-xl` for buttons, `rounded-lg` for inputs.
- **No inline `style` attributes** in React components (except OG image routes which require it).

### Testing

- **Vitest** with `happy-dom` environment
- **Unit tests** for pure functions (risk scoring, cache logic, validation)
- **Integration tests** for API routes (mock external APIs, test cache behavior)
- **Component tests** for sections (structural assertions, not snapshot-heavy)
- **No flaky tests** — avoid timing-dependent assertions. Mock `Date.now()` if needed.

---

## Pull Request Process

### PR Title Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(indexer): add Uniswap V4 swap decoding
fix(risk): correct oracle diversity scoring for multi-chain protocols
docs: update API reference with lending endpoint
chore(deps): bump next to 16.3
test(whales): add integration test for fallback provider
```

### PR Checklist

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test` passes (93+ tests)
- [ ] `npm run build` succeeds
- [ ] New features have tests
- [ ] API changes are documented in `docs/API.md`
- [ ] Breaking changes are noted in the PR description

### Review Process

1. Open a PR against `main`
2. CI runs automatically (lint, typecheck, test, build)
3. Maintainer reviews the code
4. Address feedback, push fixes
5. Squash-merge when approved

---

## Areas to Contribute

### High Impact

| Area | What's Needed |
|---|---|
| **EigenPhi MEV** | Replace heuristic MEV detection with labeled data from EigenPhi API |
| **More protocols** | Add contract addresses + event decoding for Moonwell, Compound V3, Aave V3 |
| **Token price service** | Dedicated price oracle aggregating CoinGecko + on-chain DEX prices |
| **WebSocket streaming** | Replace SSE with WebSocket for true real-time push |

### Medium Impact

| Area | What's Needed |
|---|---|
| **Agent SDK** | TypeScript + Python client packages for `/api/agents/context` |
| **E2E tests** | Playwright tests against a running dev server |
| **Alert channels** | Webhook/email/Telegram delivery for triggered alerts |
| **Protocol detail pages** | Rich per-protocol pages with charts, positions, and historical risk |

### Good First Issues

| Area | What's Needed |
|---|---|
| **Wallet labels** | Add more known wallet addresses to the community labels list |
| **OG images** | Per-tab OG images (whales tab, risk tab) |
| **Accessibility** | Audit and fix ARIA labels, keyboard navigation, screen reader support |
| **Docs** | Improve API examples, add more prompt templates to Agent Guide |

---

## Code of Conduct

Be kind. Be constructive. We're building in public.

- No harassment, discrimination, or personal attacks
- Assume good intent
- Disagree respectfully — code reviews are about the code, not the person
- Help newcomers — everyone started somewhere

---

## License

BaseForge is open source. See the root LICENSE file for terms.
