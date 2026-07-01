import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { HonestBand } from '@/src/components/HonestBand';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatClock } from '@/src/lib/time';
import { analytics } from '@/src/services/analytics';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FinishTime — the finish-time anchor (binding amendment).
//
//   Started 9:14 · Done ~9:42                       (= start + estimate)
//   on overrun → "now finishing ~9:51" re-projects forward, in amber.
//
// Surface C (Pro): while the model is still LEARNING this category, the honest
// finish is a RANGE, not a point — "Done 9:42–9:57" + a slim HonestBand that
// narrows under the row. The point finish returns once the category settles
// ('honest') or for free users. The overrun reprojection ALWAYS wins: once the
// task runs past its honest finish, the range/band hides and the amber
// "now finishing ~" reprojection takes over (the range is a forecast; once
// you're over, the live reprojection is the honest read).
//
// The re-projected clock only changes once a minute, and we only push to JS state
// when the displayed minute actually changes — so this is not a per-second
// setState driver. Clock labels are tabular text → reduced-motion safe and
// colour-independent by construction.
// ──────────────────────────────────────────────────────────────────────────────

export function FinishTime({
  elapsedSec,
  estimateSec,
  startedAt,
  startedClock,
  finishClock,
  range = null,
  confidence,
  isPro = false,
}: {
  elapsedSec: SharedValue<number>;
  estimateSec: number;
  startedAt: number;
  startedClock: string;
  finishClock: string;
  /** Honest finish range for the running category; null = no usable spread. */
  range?: HonestRange | null;
  /** Earned-Readiness of the running category. Settled ('honest') → point finish. */
  confidence?: CalibrationConfidence;
  /** Pro gates the range; free users always see the point finish. */
  isPro?: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('timer');
  const [over, setOver] = useState(false);
  // Re-projected finish minute (epoch ms, floored to the current minute of now).
  const [reprojectClock, setReprojectClock] = useState(finishClock);

  // The range is shown only while learning, Pro, and BEFORE overrun. Settled, free,
  // or unknown-category sessions keep the point finish; overrun hides it entirely.
  const showRange = isPro && range != null && confidence !== 'honest' && !over;

  // Project the range's [low, high] onto the wall clock from the SAME session start
  // the point finish uses, so the range is anchored consistently with "Done ~".
  const finishLowClock = range ? formatClock(startedAt + range.lowMinutes * 60_000) : finishClock;
  const finishHighClock = range ? formatClock(startedAt + range.highMinutes * 60_000) : finishClock;

  // honest_range_shown — fire once per running session (Surface C). Debounced on the
  // distinct band so a re-render never re-fires; fire-and-forget, never blocks.
  const lastShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showRange || range == null || confidence === undefined) return;
    const key = `${confidence}|${range.lowMinutes}|${range.highMinutes}|${isPro}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('honest_range_shown', {
      surface: 'timer',
      confidence,
      width_min: Math.round((range.highMinutes - range.lowMinutes) / 5) * 5,
      is_pro: isPro,
    });
  }, [showRange, range, confidence, isPro]);

  const view = useDerivedValue(() => {
    const isOver = elapsedSec.value >= estimateSec;
    // Re-project: finishing roughly now (elapsed already past estimate means the
    // task is still running, so the new finish is "about now"). Floor to minute.
    const nowMs = startedAt + elapsedSec.value * 1000;
    const minuteBucket = Math.floor(nowMs / 60000);
    return { isOver, minuteBucket };
  }, [estimateSec, startedAt]);

  // Format on the JS thread — `formatClock` uses `new Date()` and is NOT a
  // worklet, so it must never be called inside the UI-thread reaction below
  // (doing so aborts the app under the New Architecture). We ship the raw minute
  // bucket across the boundary and format here.
  const applyFinish = useCallback((isOver: boolean, minuteBucket: number) => {
    setOver(isOver);
    setReprojectClock(formatClock(minuteBucket * 60000));
  }, []);

  useAnimatedReaction(
    () => view.value,
    (curr, prev) => {
      if (!prev || curr.isOver !== prev.isOver || curr.minuteBucket !== prev.minuteBucket) {
        runOnJS(applyFinish)(curr.isOver, curr.minuteBucket);
      }
    },
    [applyFinish],
  );

  const wrap: ViewStyle = { alignItems: 'center', gap: t.space[1.5] };
  const row: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.space[2],
    flexWrap: 'wrap',
  };
  const bandRow: ViewStyle = { width: t.size.honestBand, maxWidth: '100%' };

  const labelStyle: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkSoft };
  const overStyle: TextStyle = { ...(type.caption as TextStyle), color: t.colors.amberText };
  // The range numerals read in the amber accent, tabular so the two clocks align.
  const rangeStyle: TextStyle = {
    ...(type.caption as TextStyle),
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };

  const a11yRange = range
    ? confidence === 'setting'
      ? tr('finish.rangeA11yLearning', { low: finishLowClock, high: finishHighClock })
      : tr('finish.rangeA11y', { low: finishLowClock, high: finishHighClock })
    : undefined;

  return (
    <View style={wrap}>
      <View style={row}>
        <AppText style={labelStyle}>{tr('finish.started', { clock: startedClock })}</AppText>
        <AppText style={labelStyle}>·</AppText>
        {over ? (
          <AppText style={overStyle}>{tr('finish.reprojecting', { clock: reprojectClock })}</AppText>
        ) : showRange && range ? (
          <AppText style={rangeStyle} accessibilityLabel={a11yRange}>
            {tr('finish.rangeDone', { low: finishLowClock, high: finishHighClock })}
          </AppText>
        ) : (
          <AppText style={labelStyle}>{tr('finish.pointDone', { clock: finishClock })}</AppText>
        )}
      </View>
      {showRange && range ? (
        <View style={bandRow}>
          <HonestBand
            range={range}
            // The honest finish the ring fills toward (estimateSec → minutes); the
            // band's tick lands on it, inside its [low, high] spread.
            point={Math.round(estimateSec / 60)}
            confidence={confidence ?? 'setting'}
            height={t.progress.gapTrack}
          />
        </View>
      ) : null}
    </View>
  );
}
