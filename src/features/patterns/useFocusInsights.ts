/**
 * useFocusInsights — wire computeFocusInsights to live stores.
 * Mirrors useLearnedFocusWindow's data sourcing; reads stores only (layer rule).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { computeFocusInsights, type FocusInsights, type FocusEventInput } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

const FOCUS_SCAN_LIMIT = 500;

export function useFocusInsights(startMin: number, endMin: number, nowMs?: number): FocusInsights | null {
  const now = nowMs ?? Date.now();
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const loadFocusEvents = useCalibrationStore((s) => s.loadFocusEvents);

  const [events, setEvents] = useState<FocusEventInput[]>([]);
  const loadRef = useRef(loadFocusEvents);
  loadRef.current = loadFocusEvents;

  useEffect(() => {
    let cancelled = false;
    loadRef.current(FOCUS_SCAN_LIMIT).then((rows) => {
      if (cancelled) return;
      setEvents(
        rows
          .filter((r) => r.startedAt != null)
          .map((r) => ({
            category: r.category,
            estimateMin: r.estimateMin,
            actualMin: r.actualMin ?? 0,
            status: r.status,
            startLocalMinute: r.startLocalMinute,
            ageDays: (now - (r.startedAt as number)) / 86_400_000,
            dayKey: Math.floor((r.startedAt as number) / 86_400_000),
          })),
      );
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFocusEvents]);

  const fitByCategory = useMemo(() => {
    const out: Record<string, { a: number; b: number }> = {};
    for (const [cat, stat] of Object.entries(statsByCategory)) out[cat] = { a: stat.fit.a, b: stat.fit.b };
    return out;
  }, [statsByCategory]);

  return useMemo(
    () => (events.length === 0 ? null : computeFocusInsights(events, fitByCategory, startMin, endMin)),
    [events, fitByCategory, startMin, endMin],
  );
}
