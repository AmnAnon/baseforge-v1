// worker/webhook-url.ts — SSRF-safe webhook validation (sync only; no dns/promises in worker bundle)

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

export function validateWebhookUrlSync(raw: string): { ok: true } | { ok: false; error: string } {
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

  return { ok: true };
}