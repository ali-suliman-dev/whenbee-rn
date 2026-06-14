import { useCallback, useState } from 'react';
import { View, type TextStyle, type ViewStyle } from 'react-native';
import {
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatClock } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// FinishTime — the finish-time anchor (binding amendment).
//
//   Started 9:14 · Done ~9:42                       (= start + estimate)
//   on overrun → "now finishing ~9:51" re-projects forward, in amber.
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
}: {
  elapsedSec: SharedValue<number>;
  estimateSec: number;
  startedAt: number;
  startedClock: string;
  finishClock: string;
}) {
  const t = useTheme();
  const [over, setOver] = useState(false);
  // Re-projected finish minute (epoch ms, floored to the current minute of now).
  const [reprojectClock, setReprojectClock] = useState(finishClock);

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

  const row: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.space[2],
    flexWrap: 'wrap',
  };

  const labelStyle: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkSoft };
  const overStyle: TextStyle = { ...(type.caption as TextStyle), color: t.colors.amberText };

  return (
    <View style={row}>
      <AppText style={labelStyle}>Started {startedClock}</AppText>
      <AppText style={labelStyle}>·</AppText>
      {over ? (
        <AppText style={overStyle}>now finishing ~{reprojectClock}</AppText>
      ) : (
        <AppText style={labelStyle}>Done ~{finishClock}</AppText>
      )}
    </View>
  );
}
