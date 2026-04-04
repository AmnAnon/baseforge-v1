// src/lib/api-client.ts
// Resilient HTTP client with exponential backoff, timeout, and RPC fallback

export interface FetchOptions extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  fallbackUrls?: string[]; // RPC fallback chain
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF = 1_000;

export class APIError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class TimeoutError extends APIError {
  constructor(url: string) {
    super(`Request timed out after ${DEFAULT_TIMEOUT}ms`, url, undefined);
    this.name = "TimeoutError";
  }
}

export class MaxRetriesError extends APIError {
  constructor(url: string, cause?: unknown) {
    super(`Max retries exceeded for ${url}`, url, undefined, cause);
    this.name = "MaxRetriesError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout, exponential backoff retry, and optional fallback URLs.
 */
export async function resilientFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF,
    fallbackUrls,
    ...fetchInit
  } = options;

  const urls = [url, ...(fallbackUrls ?? [])];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const target of urls) {
      let controller: AbortController | undefined;
      try {
        controller = new AbortController();
        const id = setTimeout(() => controller!.abort(), timeoutMs);

        const response = await fetch(target, {
          ...fetchInit,
          signal: controller.signal,
        });
        clearTimeout(id);

        if (!response.ok) {
          throw new APIError(
            `HTTP ${response.status}: ${response.statusText}`,
            target,
            response.status
          );
        }

        return (await response.json()) as T;
      } catch (err: unknown) {
        lastError = err;
        controller?.abort();

        // Don't retry 4xx (except 429)
        if (err instanceof APIError && err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
          throw err;
        }
      }
    }

    if (attempt < retries) {
      const delay = backoffMs * 2 ** attempt + Math.random() * backoffMs;
      await sleep(delay);
    }
  }

  throw new MaxRetriesError(url, lastError);
}
