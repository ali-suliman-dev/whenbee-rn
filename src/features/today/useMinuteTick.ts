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
//
// The interval alone is not enough: iOS suspends timers while the app is
// backgrounded, so a screen reopened two hours later would keep showing the tick
// it froze on until the next fire. `AppState` 'active' therefore re-reads the
// clock immediately — the same foreground-resync the sibling day-reads
// (`useDayCapacity`, `useHonestDay`) already do.
// ──────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';
import { AppState, type NativeEventSubscription } from 'react-native';

/** The day-read speaks in whole minutes, so one tick a minute is exact enough. */
export const MINUTE_TICK_MS = 60_000;

let currentMs = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
const listeners = new Set<() => void>();

/** Re-read the clock and wake every subscriber. */
function tick(): void {
  currentMs = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (intervalId === null) {
    // First subscriber after an idle period: the stored tick can be arbitrarily
    // old, so re-read the clock before starting the heartbeat.
    currentMs = Date.now();
    intervalId = setInterval(tick, MINUTE_TICK_MS);
    // The interval does not run while the app is suspended, so foregrounding is
    // where the tick is most stale — resync there rather than wait out a minute.
    appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') tick();
    });
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      appStateSub?.remove();
      appStateSub = null;
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
