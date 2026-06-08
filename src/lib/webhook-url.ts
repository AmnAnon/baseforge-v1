// src/lib/webhook-url.ts
// SSRF-safe webhook URL validation for alert delivery.

import { lookup } from "dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.goog",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const n = ip.toLowerCase();
  if (n === "::1") return true;
  if (n.startsWith("fc") || n.startsWith("fd")) return true;
  if (n.startsWith("fe80")) return true;
  return false;
}

export type WebhookUrlValidation =
  | { ok: true; url: URL }
  | { ok: false; error: string };

/** Synchronous checks (protocol, host blocklist, literal private IPs). */
export function validateWebhookUrlSync(raw: string): WebhookUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "webhookUrl must use HTTPS" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Credentials in webhook URL are not allowed" };
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, error: "Host is not allowed" };
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIPv4(host)) {
    return { ok: false, error: "Private IP addresses are not allowed" };
  }

  if (host.includes(":") && isPrivateIPv6(host)) {
    return { ok: false, error: "Private IP addresses are not allowed" };
  }

  return { ok: true, url: parsed };
}

/** Full validation including DNS resolution (blocks metadata / internal rebinding). */
export async function validateWebhookUrl(raw: string): Promise<WebhookUrlValidation> {
  const sync = validateWebhookUrlSync(raw);
  if (!sync.ok) return sync;

  const host = sync.url.hostname;
  const isLiteralIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");

  if (!isLiteralIp) {
    try {
      const [v4, v6] = await Promise.allSettled([
        lookup(host, { family: 4 }),
        lookup(host, { family: 6 }),
      ]);

      const addresses: string[] = [];
      if (v4.status === "fulfilled") addresses.push(v4.value.address);
      if (v6.status === "fulfilled") addresses.push(v6.value.address);

      if (addresses.length === 0) {
        return { ok: false, error: "Could not resolve hostname" };
      }

      for (const addr of addresses) {
        if (isPrivateIPv4(addr) || isPrivateIPv6(addr)) {
          return { ok: false, error: "Host resolves to a private or link-local address" };
        }
      }
    } catch {
      return { ok: false, error: "Could not resolve hostname" };
    }
  }

  return sync;
}