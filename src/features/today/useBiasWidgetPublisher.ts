import { useEffect } from 'react';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { pickTopBias } from '@/src/engine';
import { categoryName } from '@/src/features/today/categoryName';
import { publishWidgetData, clearWidgetData } from '@/src/services/presence/widgetData';
import type { BiasWidgetData, LockedBiasWidgetData } from '@/src/services/presence/widgetData';

/** Key the "Your Bias" Home-screen widget (Pro) reads its payload from. */
const BIAS_WIDGET_KEY = 'bias';

/** Formats a multiplier for the widget: 1 decimal place, ">1 = over, <1 =
 *  under, ~1 (rounds to 1.0) reads as on the mark and stays neutral wording. */
function formatMultiplierText(multiplier: number): string {
  const rounded = multiplier.toFixed(1);
  if (rounded === '1.0') return `${rounded}× on the mark`;
  return multiplier > 1 ? `${rounded}× over` : `${rounded}× under`;
}

/**
 * Keeps the "Your Bias" Home-screen widget (Pro) live — surfaces the single
 * most-notable per-category bias the user has personally earned, via the
 * pure `pickTopBias` selector (see `src/engine/widgetBias.ts`). Mount this
 * once, sibling to `useCapacityWidgetPublisher` / `useWidgetPublisher` —
 * unlike those two it subscribes to its own stores directly since it has no
 * existing feature hook to piggyback on.
 *
 * Pro-gate-at-source (hard product invariant): a free user's payload is
 * ALWAYS the locked sentinel `{ isPro: false }` — no category, no
 * multiplier, no tier. Never widen this to "isPro:false + neutral fields";
 * that still leaks the user's real bias through the back door.
 *
 * All reads/writes are best-effort — a widget write must never throw into
 * the caller, since this sits in the Today render path.
 */
export function useBiasWidgetPublisher(): void {
  const isPro = useEntitlement((s) => s.isPro);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  useEffect(() => {
    try {
      if (!isPro) {
        const locked: LockedBiasWidgetData = { isPro: false };
        publishWidgetData(BIAS_WIDGET_KEY, locked);
        return;
      }
      const top = pickTopBias(statsByCategory);
      if (top === null) {
        clearWidgetData(BIAS_WIDGET_KEY);
        return;
      }
      const payload: BiasWidgetData = {
        categoryLabel: categoryName(top.categoryId),
        multiplierText: formatMultiplierText(top.multiplier),
        tier: top.tier,
        updatedAtEpoch: Math.round(Date.now() / 1000),
        isPro: true,
      };
      publishWidgetData(BIAS_WIDGET_KEY, payload);
    } catch {
      // best-effort; a widget write must never break the Today render path
    }
  }, [isPro, statsByCategory]);
}
