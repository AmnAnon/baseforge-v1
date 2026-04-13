# Security Policy

## Supported Versions

| Version        | Supported          |
| -------------- | ------------------ |
| >= 1.0.0       | :white_check_mark: |
| < 1.0.0        | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability, please report it **privately** via one of these channels:

### Preferred: GitHub Security Advisories

Use [GitHub's private vulnerability reporting](https://github.com/AmnAnon/baseforge-v1/security/advisories/new) to disclose issues. This lets us collaborate securely without exposing details publicly.

### Alternative: Email

Send your report to **security@baseforge.dev** (or contact the maintainers via GitHub) with:
- **Subject:** `[BaseForge Security] <short description>`
- **Body:** Steps to reproduce, impact assessment, suggested fix (if any)

### Response SLA

| Milestone | Commitment |
|---|---|
| **Acknowledgment** | Within **48 hours** |
| **Initial assessment** | Within **72 hours** |
| **Fix or timeline** | Within **14 days** |
| **Public disclosure** | After patch is released (coordinated) |

If you don't receive acknowledgment within 48 hours, follow up — we may have missed your message.

## What We Consider a Security Issue

- **API key leakage** — keys exposed in logs, error traces, or client-side code
- **Rate limit bypass** — any way to exceed configured limits
- **Data exposure** — private wallet data, frame interaction PII leaked
- **Authentication bypass** — accessing admin endpoints without valid credentials
- **Injection** — SQL injection via Drizzle queries, XSS in API responses
- **Supply chain** — compromised dependencies, malicious scripts in `node_modules`

## What We Don't

- Test failures, lint warnings, or cosmetic issues (use Issues/PRs)
- DDoS protection (we rely on Vercel/Cloudflare infrastructure)
- Upstream API outages (DefiLlama, Envio, Etherscan)

## Responsible Disclosure

- **Do NOT** open a public GitHub Issue for security concerns.
- **Do NOT** exploit the vulnerability beyond what's necessary to demonstrate it.
- **Do NOT** access or modify other users' data.

We credit reporters who report valid vulnerabilities and welcome public acknowledgment (with your permission) in release notes.

## Bounty Program 🏴‍☠️

We offer recognition for valid security reports. While we don't have a formal paid bug bounty program yet, contributors who report critical vulnerabilities will be:
- Credited in our release notes (with permission)
- Invited as official contributors
- Recognized in our `SECURITY.md` hall of fame

Contact us to discuss bounty eligibility before public disclosure.

## Security Architecture

### Data at Rest
- API keys: stored hashed in Postgres (SHA-256 + salt)
- Session tokens: HTTP-only, Secure, SameSite=Strict cookies
- No private keys ever stored or transmitted

### Data in Transit
- All API endpoints require HTTPS (enforced by Vercel)
- CSP headers restrict script/style/font/image sources
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`

### Authentication
- Admin endpoints: `ADMIN_KEY` environment variable (Vercel encrypted secrets)
- API consumers: per-key rate limiting with usage tracking
- Farcaster frames: verified via Warpcast domain association

### Rate Limiting
- Per-IP sliding window (in-memory for dev, Upstash Redis for prod)
- Per-API-key quotas (free tier: 100 req/min, paid: 1000 req/min)
- Admin-configurable via environment variables

---

_Last updated: April 2026_
