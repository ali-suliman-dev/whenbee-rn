import { useState } from 'react';
import { type TextStyle, type ViewStyle, View, Pressable } from 'react-native';
import Animated, {
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
  FadeIn,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { haptics } from '@/src/lib/haptics';
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

// Pure so it can drive both the UI-thread derived value and the state's lazy
// initializer (the initial render — before any reaction has fired — must
// already reflect the real elapsedSec, not a hardcoded guess).
function computePace(elapsedSec: number, estimateSec: number): { phase: Phase; over: number } {
  'worklet';
  const left = Math.floor((estimateSec - elapsedSec) / 60);
  let p: Phase;
  if (elapsedSec >= estimateSec) p = 'over';
  else if (left <= 3) p = 'closing';
  else p = 'under';
  const over = p === 'over' ? Math.floor((elapsedSec - estimateSec) / 60) : 0;
  return { phase: p, over };
}

export function PaceLabel({
  elapsedSec,
  estimateSec,
  onForgotPress,
}: {
  elapsedSec: SharedValue<number>;
  estimateSec: number;
  onForgotPress?: () => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(() => computePace(elapsedSec.value, estimateSec).phase);
  const [overMin, setOverMin] = useState(() => computePace(elapsedSec.value, estimateSec).over);

  // Phase + over-amount as derived values (UI thread).
  const view = useDerivedValue(() => computePace(elapsedSec.value, estimateSec), [estimateSec]);

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

  const pill = (
    <View style={wrap} accessibilityLiveRegion="polite">
      <AppText style={baseStyle}>{copy}</AppText>
    </View>
  );

  if (!isOver || !onForgotPress) return pill;

  // Reads as an inline text link: underlined + full ink (a muted underline looks
  // disabled). Stays a quiet recovery affordance beside the amber pace pill — no
  // amber, no weight bump, so it never competes with the pill.
  const forgotStyle: TextStyle = {
    ...(type.caption as TextStyle),
    color: t.colors.ink,
    textDecorationLine: 'underline',
  };

  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: t.space[3],
  };

  return (
    <View style={rowStyle}>
      {pill}
      <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(t.motion.fast)}>
        <Pressable
          onPress={() => {
            haptics.light();
            onForgotPress();
          }}
          accessibilityRole="button"
          accessibilityLabel="Forgot to stop the timer earlier"
          hitSlop={t.size.hitSlop}
          style={{ paddingVertical: t.space[1] }}
        >
          <AppText style={forgotStyle}>Forgot to stop?</AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
}
