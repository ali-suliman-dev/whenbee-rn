import { useEffect } from 'react';
import { useTimerStore } from '@/src/stores/timerStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { formatClock, projectedFinish } from '@/src/lib/time';
import { publishWidgetData, clearWidgetData } from '@/src/services/presence/widgetData';
import { categoryName } from '@/src/features/today/categoryName';
import type { WidgetSnapshot } from '@/src/services/liveActivity';
import type { DayTask } from '@/src/engine/daySelectors';

/** Key the Home-screen widget reads the next-task snapshot from. */
const NEXT_TASK_WIDGET_KEY = 'nextTask';

interface UseWidgetPublisherArgs {
  /** The task Today is currently focused on, or null when the day is empty/done. */
  focus: DayTask | null;
  /** The focus task's learned honest estimate in minutes, or null while unresolved. */
  honestMin: number | null;
}

/**
 * Keeps the Home-screen "Honest Finish" widget live. Mounted once by
 * `useToday`. Subscribes REACTIVELY to everything that can change what the
 * widget should show — focus/honestMin (the next task itself), whether a
 * timer is running, Pro entitlement (so a purchase lights the rich widget
 * immediately, not on the next unrelated re-render), and the focus category's
 * learned multiplier (so a fresh log re-sharpens the finish time right away).
 *
 * All reads/writes are best-effort — a widget write must never throw into the
 * caller, since this sits in the core Today render path.
 */
export function useWidgetPublisher({ focus, honestMin }: UseWidgetPublisherArgs): void {
  const isRunning = useTimerStore((s) => s.isRunning);
  const isPro = useEntitlement((s) => s.isPro);
  const mEffective = useCalibrationStore((s) =>
    focus ? s.statsByCategory[focus.category]?.mEffective : undefined,
  );

  useEffect(() => {
    try {
      if (!focus || honestMin === null) {
        clearWidgetData(NEXT_TASK_WIDGET_KEY);
        return;
      }
      const now = Date.now();
      const finishAt = projectedFinish(now, honestMin);
      const snapshot: WidgetSnapshot = {
        nextTaskLabel: focus.label,
        category: categoryName(focus.category),
        honestFinishClock: formatClock(finishAt),
        startDeepLink: `whenbee://timer?taskId=${focus.id}`,
        updatedAtEpoch: Math.round(now / 1000),
        honestFinishEpoch: Math.round(finishAt / 1000),
        isPro,
      };
      publishWidgetData(NEXT_TASK_WIDGET_KEY, snapshot);
    } catch {
      // best-effort; a widget write must never break the Today render path
    }
    // isRunning + mEffective aren't read directly above — they're subscribed to
    // purely so the effect re-fires when either changes (see doc comment).
  }, [focus, honestMin, isRunning, isPro, mEffective]);
}
