// ──────────────────────────────────────────────────────────────────────────────
// useMinuteTick — one shared wall-clock heartbeat for the Today day-read.
//
// Two things on Today have to move with the clock: the landing time itself and
// the meeting minutes still ahead of now. They must agree, and the second must
// never be computed by a `Date.now()` call buried in a memo keyed on the event
// list — that snapshot freezes at first render and the number quietly rots.
//
// So the tick is an external store rather than per-hook state: every subscriber
// reads the SAME `nowMs` off one interval, which also means one timer and one
// re-render per minute no matter how many consumers mount.
// ──────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';

/** The day-read speaks in whole minutes, so one tick a minute is exact enough. */
export const MINUTE_TICK_MS = 60_000;

let currentMs = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (intervalId === null) {
    // First subscriber after an idle period: the stored tick can be arbitrarily
    // old, so re-read the clock before starting the heartbeat.
    currentMs = Date.now();
    intervalId = setInterval(() => {
      currentMs = Date.now();
      for (const listener of listeners) listener();
    }, MINUTE_TICK_MS);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return currentMs;
}

/** Epoch ms, refreshed once a minute. Identical for every caller on the screen. */
export function useMinuteTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
