import { useEffect } from 'react';
import { publishWidgetData, clearWidgetData } from '@/src/services/presence/widgetData';
import type {
  CapacityWidgetData,
  LockedCapacityWidgetData,
} from '@/src/services/presence/widgetData';
import type { DayCapacityResult } from '@/src/features/today/useDayCapacity';

/** Key the "Does Today Fit?" Home-screen widget reads its payload from. */
const CAPACITY_WIDGET_KEY = 'capacity';

/**
 * Keeps the "Does Today Fit?" Home-screen widget (Pro) live from the existing
 * `useDayCapacity()` result — it only maps/republishes, it never recomputes
 * capacity (the engine in `honestDayLoad.ts` is the single source of truth).
 *
 * Mount this wherever `useDayCapacity()` is already called (currently the
 * Today tab screen), passing its result straight through — mirrors how
 * `useWidgetPublisher` is mounted from `useToday`.
 *
 * Pro-gate-at-source (hard product invariant): a free user's payload is ALWAYS
 * the locked sentinel `{ isPro: false }` — no verdict, no slack, no overBy.
 * Never widen this to "isPro:false + neutral numbers"; that still leaks the
 * user's real day-load position through the back door.
 *
 * All reads/writes are best-effort — a widget write must never throw into the
 * caller, since this sits in the Today render path.
 */
export function useCapacityWidgetPublisher(cap: DayCapacityResult): void {
  const { status, load, isPro } = cap;

  useEffect(() => {
    try {
      if (!isPro) {
        const locked: LockedCapacityWidgetData = { isPro: false };
        publishWidgetData(CAPACITY_WIDGET_KEY, locked);
        return;
      }
      if (status !== 'ready' || load === null) {
        clearWidgetData(CAPACITY_WIDGET_KEY);
        return;
      }
      const isOver = load.verdict === 'over';
      const payload: CapacityWidgetData = {
        verdict: load.verdict,
        slackMin: isOver ? 0 : load.openMin,
        overByMin: isOver ? load.overByMin : 0,
        updatedAtEpoch: Math.round(Date.now() / 1000),
        isPro: true,
      };
      publishWidgetData(CAPACITY_WIDGET_KEY, payload);
    } catch {
      // best-effort; a widget write must never break the Today render path
    }
  }, [status, load, isPro]);
}
