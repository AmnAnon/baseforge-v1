// src/lib/db/frame-analytics.ts
// Non-blocking frame analytics logger with strict timeout.
// Designed for serverless: Promise.race() against 300ms so the DB never
// holds up the Farcaster frame response.

import { db } from "./client";
import { frameInteractions } from "./schema";

const FRAME_LOG_TIMEOUT_MS = 300;

export interface FrameLogPayload {
  fid?: number;
  buttonIndex: number;
  action?: string;
  castFid?: number;
  castHash?: string;
  messageHash?: string;
  address?: string;
  tab?: string;
  protocol?: string;
  route: string;
}

const DB_TIMEOUT_MS = 300;

/**
 * Insert a frame interaction row, racing against a hard timeout.
 * If the DB is cold / slow we give up after DB_TIMEOUT_MS and return false
 * so the caller can proceed without blocking the user.
 */
export async function logFrameInteraction(
  payload: FrameLogPayload
): Promise<boolean> {
  const start = Date.now();

  try {
    const insertPromise = db.insert(frameInteractions).values({
      fid: payload.fid ?? null,
      buttonIndex: payload.buttonIndex,
      action: payload.action,
      castFid: payload.castFid ?? null,
      castHash: payload.castHash ?? null,
      messageHash: payload.messageHash ?? null,
      address: payload.address ?? null,
      tab: payload.tab ?? null,
      protocol: payload.protocol ?? null,
      route: payload.route,
    }).execute();

    const timedOut = await raceWithTimeout(insertPromise, DB_TIMEOUT_MS);

    if (timedOut) {
      console.warn(
        `[frame-analytics] insert timed out after ${DB_TIMEOUT_MS}ms (DB cold?)`
      );
      return false;
    }

    console.log(
      `[frame-analytics] logged interaction fid=${payload.fid} btn=${payload.buttonIndex} in ${Date.now() - start}ms`
    );
    return true;
  } catch (err) {
    console.error("[frame-analytics] insert failed:", err);
    return false;
  }
}

/**
 * Race a promise against a timeout.
 * Returns `true` if the promise did NOT settle before the timeout.
 */
async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<boolean> {
  return Promise.race([
    promise.then(() => false),
    sleep(true, ms),
  ]);
}

function sleep<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

/**
 * Resolve with `true` after `ms` milliseconds.
 * The second return branch of Promise.race() so it stands out.
 */
function sleepThen(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), ms);
  });
}
