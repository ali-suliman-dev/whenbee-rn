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
// PaceLabel — the no-guilt pace pill pinned above the controls.
//
//   under  → "You've got time"                (soft-indigo pill)
//   ≤3 min → "Almost at your guess"           (soft-indigo pill)
//   over   → "N over your guess — now you know" (soft-amber pill)
//
// It reads elapsedSec on the UI thread but only sets React state when the *phase*
// (or the over-amount) actually changes — NOT every second. So the second-by-
// second tick never triggers a layout pass; copy only re-renders on a meaningful
// threshold crossing. The pill warms to amber on overrun, never red.
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

  const isOver = phase === 'over';

  const wrap: ViewStyle = {
    alignSelf: 'center',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2.5],
    borderRadius: t.radii.full,
    backgroundColor: isOver ? t.colors.accentSoft : t.colors.primarySoft,
  };

  const baseStyle: TextStyle = {
    ...(type.caption as TextStyle),
    textAlign: 'center',
    color: isOver ? t.colors.amberText : t.colors.ink,
  };

  let copy: string;
  if (isOver) copy = overMin > 0 ? `${overMin}m over your guess — now you know` : 'Past your guess — now you know';
  else if (phase === 'closing') copy = 'Almost at your guess';
  else copy = 'You’ve got time';

  return (
    <View style={wrap} accessibilityLiveRegion="polite">
      <AppText style={baseStyle}>{copy}</AppText>
    </View>
  );
}
