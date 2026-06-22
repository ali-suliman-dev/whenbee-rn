/**
 * useLearnedFocusWindow — wire the pure `learnFocusWindow` engine to live data.
 *
 * Layer rule: this is a FEATURE hook. It reads stores only; it never imports
 * from src/db or src/services. Completed events flow in via
 * `useCalibrationStore.loadFocusEvents` (a store method, not a repo call).
 *
 * Data sources:
 * - Events: `calibrationStore.loadFocusEvents()` — returns cross-category rows
 *   with startLocalMinute and startedAt already present (set on the write path
 *   via `new Date(startedAt).getHours()*60 + getMinutes()`).
 * - Fits: `calibrationStore.statsByCategory[cat].fit` — the pre-solved AffineFit
 *   (a + b·guess) already computed during hydrate/applyLog. No need to re-run
 *   solveAffine here; just read the cached result.
 * - Shown window + userSet: `settingsStore`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { learnFocusWindow } from '@/src/engine';
import type { LearnedFocusWindow, FocusEventInput } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

// How many events to scan. Generous (focus learning wants history) but bounded.
const FOCUS_SCAN_LIMIT = 500;

/**
 * Returns the current learned (or prior-fallback) focus window.
 *
 * Side-effect: if `!focusWindowUserSet` and the engine returns a `personal`
 * window that isn't `held`, calls `setLearnedFocusWindow` to persist it.
 *
 * @param nowMs - Epoch ms for the current moment. Defaults to `Date.now()`.
 *   Exposed as a parameter so tests can inject a fixed clock without mocking.
 */
export function useLearnedFocusWindow(nowMs?: number): LearnedFocusWindow {
  // Resolve nowMs once at the hook boundary (Date.now() allowed here — the engine
  // is clock-free, but the hook is a React layer and may use the clock).
  const now = nowMs ?? Date.now();

  // ── store selectors ──────────────────────────────────────────────────────────
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const loadFocusEvents = useCalibrationStore((s) => s.loadFocusEvents);

  const focusWindowUserSet = useSettingsStore((s) => s.focusWindowUserSet);
  const focusShownStartMin = useSettingsStore((s) => s.focusShownStartMin);
  const focusShownEndMin = useSettingsStore((s) => s.focusShownEndMin);
  const focusLastMoveAtMs = useSettingsStore((s) => s.focusLastMoveAtMs);
  const setLearnedFocusWindow = useSettingsStore((s) => s.setLearnedFocusWindow);

  // ── event loading ────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<FocusEventInput[]>([]);
  // Stable reference to avoid stale closure in the effect below.
  const loadRef = useRef(loadFocusEvents);
  loadRef.current = loadFocusEvents;

  useEffect(() => {
    let cancelled = false;
    loadRef.current(FOCUS_SCAN_LIMIT).then((rows) => {
      if (cancelled) return;
      const mapped: FocusEventInput[] = rows
        .filter((r) => r.startedAt != null) // skip null-startedAt (retroactive)
        .map((r) => ({
          category: r.category,
          estimateMin: r.estimateMin,
          actualMin: r.actualMin ?? 0,
          status: r.status,
          startLocalMinute: r.startLocalMinute,
          ageDays: (now - (r.startedAt as number)) / 86_400_000,
          dayKey: Math.floor((r.startedAt as number) / 86_400_000),
        }));
      setEvents(mapped);
    });
    return () => {
      cancelled = true;
    };
    // Re-load when the store method reference changes (i.e. after a log is applied
    // and calibrationStore re-hydrates). `now` is intentionally excluded to avoid
    // a reload every render — the event list doesn't change with time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFocusEvents]);

  // ── fit map ──────────────────────────────────────────────────────────────────
  // Derive fitByCategory from the pre-solved AffineFit in statsByCategory.
  // The calibration store already runs solveAffine during hydrate and applyLog,
  // so we never need to re-derive it here.
  const fitByCategory = useMemo(() => {
    const out: Record<string, { a: number; b: number }> = {};
    for (const [cat, stat] of Object.entries(statsByCategory)) {
      out[cat] = { a: stat.fit.a, b: stat.fit.b };
    }
    return out;
  }, [statsByCategory]);

  // ── shown window ─────────────────────────────────────────────────────────────
  const shown = useMemo(() => {
    if (focusShownStartMin == null || focusShownEndMin == null || focusLastMoveAtMs == null) {
      return null;
    }
    return {
      startMin: focusShownStartMin,
      endMin: focusShownEndMin,
      lastMoveAtDays: (now - focusLastMoveAtMs) / 86_400_000,
    };
  }, [focusShownStartMin, focusShownEndMin, focusLastMoveAtMs, now]);

  // ── engine call ───────────────────────────────────────────────────────────────
  const result = useMemo(
    () => learnFocusWindow({ events, fitByCategory, shown }),
    [events, fitByCategory, shown],
  );

  // ── auto-persist effect ───────────────────────────────────────────────────────
  // Write the learned window into settingsStore when:
  //   1. The engine gained enough data to say 'personal', AND
  //   2. The user hasn't manually overridden their window, AND
  //   3. Hysteresis didn't hold the previous window (the window actually moved).
  useEffect(() => {
    if (!focusWindowUserSet && result.basis === 'personal' && !result.held) {
      setLearnedFocusWindow(result.startMin, result.endMin, now);
    }
    // Run whenever the engine result or the user-set flag changes.
    // `now` is included so a clock-injection in tests also triggers this.
  }, [result, focusWindowUserSet, setLearnedFocusWindow, now]);

  return result;
}
