import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import {
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { HonestBand } from '@/src/components/HonestBand';
import { InfoRow, LedgerValue } from '@/src/features/timer/InfoRow';
import { useTheme } from '@/src/theme/useTheme';
import { formatClock } from '@/src/lib/time';
import { analytics } from '@/src/services/analytics';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FinishTime — the STARTED + FINISH rows of the Live-Timer info ledger.
//
//   STARTED                                          9:14
//   FINISH ~                                         9:42          (= start + estimate)
//   on overrun → the FINISH value re-projects forward, in amber ("~9:51").
//
// Surface C (Pro): while the model is still LEARNING this category, the honest
// finish is a RANGE, not a point — "9:42–9:57" + a slim HonestBand that narrows
// full-width under the row. The point finish returns once the category settles
// ('honest') or for free users. The overrun reprojection ALWAYS wins: once the
// task runs past its honest finish, the range/band hides and the amber
// reprojected clock takes over (the range is a forecast; once you're over, the
// live reprojection is the honest read).
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

  // The band spans the full ledger width beneath the FINISH row (was a fixed,
  // centred width when the finish was a single centred line).
  const bandRow: ViewStyle = { width: '100%', marginTop: t.space[1] };

  const a11yRange = range
    ? `Honest finish range ${finishLowClock} to ${finishHighClock}${confidence === 'setting' ? ', still learning' : ''}.`
    : undefined;

  return (
    <>
      <InfoRow label="Started">
        <LedgerValue>{startedClock}</LedgerValue>
      </InfoRow>
      <InfoRow label="Finish ~">
        {over ? (
          <LedgerValue amber>~{reprojectClock}</LedgerValue>
        ) : showRange && range ? (
          <LedgerValue amber accessibilityLabel={a11yRange}>
            {finishLowClock}–{finishHighClock}
          </LedgerValue>
        ) : (
          <LedgerValue>{finishClock}</LedgerValue>
        )}
      </InfoRow>
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
    </>
  );
}
