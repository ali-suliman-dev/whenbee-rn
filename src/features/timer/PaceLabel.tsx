import { useState } from 'react';
import { type TextStyle, type ViewStyle, View } from 'react-native';
import {
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PaceLabel — the no-guilt pace line under the ring.
//
//   under  → "On track · breathe, you've got time"
//   ≤3 min → "Closing in on your guess… that's fine"
//   over   → amber "+N over your guess — that's ok, now we know"
//
// It reads elapsedSec on the UI thread but only sets React state when the *phase*
// (or the over-amount) actually changes — NOT every second. So the second-by-
// second tick never triggers a layout pass; copy only re-renders on a meaningful
// threshold crossing. Amber on overrun, never red.
// ──────────────────────────────────────────────────────────────────────────────

type Phase = 'under' | 'closing' | 'over';

export function PaceLabel({
  elapsedSec,
  estimateSec,
}: {
  elapsedSec: SharedValue<number>;
  estimateSec: number;
}) {
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>('under');
  const [overMin, setOverMin] = useState(0);

  // Phase + over-amount as derived values (UI thread).
  const view = useDerivedValue(() => {
    const left = Math.floor((estimateSec - elapsedSec.value) / 60);
    let p: Phase;
    if (elapsedSec.value >= estimateSec) p = 'over';
    else if (left <= 3) p = 'closing';
    else p = 'under';
    const over = p === 'over' ? Math.floor((elapsedSec.value - estimateSec) / 60) : 0;
    return { phase: p, over };
  }, [estimateSec]);

  // Only push to JS state when the visible copy would actually change.
  useAnimatedReaction(
    () => view.value,
    (curr, prev) => {
      if (!prev || curr.phase !== prev.phase || curr.over !== prev.over) {
        runOnJS(setPhase)(curr.phase);
        runOnJS(setOverMin)(curr.over);
      }
    },
    [],
  );

  const wrap: ViewStyle = { alignItems: 'center', minHeight: 24, justifyContent: 'center' };

  const baseStyle: TextStyle = {
    ...(type.bodySm as TextStyle),
    textAlign: 'center',
    color: phase === 'over' ? t.colors.amberText : t.colors.inkSoft,
  };

  let copy: string;
  if (phase === 'over') copy = `+${overMin} over your guess — that's ok, now we know`;
  else if (phase === 'closing') copy = 'Closing in on your guess… that’s fine';
  else copy = 'On track · breathe, you’ve got time';

  return (
    <View style={wrap} accessibilityLiveRegion="polite">
      <AppText style={baseStyle}>{copy}</AppText>
    </View>
  );
}
