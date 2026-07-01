import { useCallback, useEffect } from 'react';
import { View, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// GuardrailCheckIn — the hyperfocus guardrail's calm amber in-app card (Pro).
//
// It slides up over the LOWER timer controls (never over the ring) when a session
// passes its honest-number multiple. Personality: Premium / Calm — a friend leaning
// in, not an alarm. One nudge per session; "Keep going" is the prominent answer.
//
// Motion: entrance is the heavier beat (slide up + fade, motion.sheet, easing.out).
// Dismiss is driven by an explicit shared-value timing (motion.base) — NO `exiting`
// layout animation (Fabric SIGABRT on a conditionally-unmounted view). The parent
// keeps the card mounted while `guardDue` is true; we play the slide-down, then call
// the chosen action AFTER the timing settles so the unmount happens post-animation.
// Reduced motion → instant in/out. Amber only, never red. No pulse, no blink.
// ──────────────────────────────────────────────────────────────────────────────

export function GuardrailCheckIn({
  taskLabel,
  elapsedMin,
  bottomInset = 0,
  onKeepGoing,
  onWrapUp,
}: {
  taskLabel: string;
  elapsedMin: number;
  /** Safe-area bottom inset so the panel clears the home indicator. */
  bottomInset?: number;
  onKeepGoing: () => void;
  onWrapUp: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('timer');
  const reducedMotion = useReducedMotion();

  // 0 = resting (card up, fully shown); 1 = off-screen below + faded. Starts at 1 so
  // the mount animates UP into place. Drives both the slide and the opacity.
  const hidden = useSharedValue(1);
  const slide = t.space[16]; // 64 — reuse the spacing scale, no one-off distance token

  useEffect(() => {
    if (reducedMotion) {
      hidden.set(0);
      return;
    }
    haptics.light(); // a single soft "tap on the shoulder" as the card lands
    hidden.set(
      withTiming(0, {
        duration: t.motion.sheet,
        easing: t.motion.easing.out,
        reduceMotion: ReduceMotion.System,
      }),
    );
    // Mount-once entrance — the card only ever mounts when a nudge is due.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: 1 - hidden.value,
    transform: [{ translateY: hidden.value * slide }],
  }));

  // Play the slide-down, then hand back to the parent so the unmount happens after
  // the motion settles (no `exiting` prop → no Fabric abort).
  const dismissThen = useCallback(
    (done: () => void) => {
      if (reducedMotion) {
        done();
        return;
      }
      hidden.set(
        withTiming(
          1,
          {
            duration: t.motion.base,
            easing: t.motion.easing.standard,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) runOnJS(done)();
          },
        ),
      );
    },
    [reducedMotion, hidden, t.motion.base, t.motion.easing.standard],
  );

  const keepGoing = useCallback(() => dismissThen(onKeepGoing), [dismissThen, onKeepGoing]);
  const wrapUp = useCallback(() => dismissThen(onWrapUp), [dismissThen, onWrapUp]);

  // ── styles (every value a token) ────────────────────────────────────────────
  const panel: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    // The single amber accent: a thin top rule. Amber = "worth a glance", the same
    // warmth as PaceLabel's over-pill — never alarm. It fades in with the card and
    // never pulses.
    borderTopWidth: t.borderWidth.thick,
    borderTopColor: t.colors.accent,
    paddingHorizontal: t.space[5],
    paddingTop: t.space[5],
    paddingBottom: t.space[5] + bottomInset,
    gap: t.space[4],
  };
  const headingStyle: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const bodyStyle: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const actions: ViewStyle = { gap: t.space[2.5] };

  return (
    <Animated.View
      style={[panel, panelStyle]}
      accessibilityViewIsModal={false}
      accessibilityLiveRegion="polite"
    >
      <AppText style={headingStyle}>{tr('guardrail.heading')}</AppText>
      <AppText style={bodyStyle}>
        {tr('guardrail.body', { count: elapsedMin, taskLabel })}
      </AppText>
      <View style={actions}>
        <AppButton
          label={tr('guardrail.keepGoing')}
          variant="amber"
          size="md"
          fullWidth
          onPress={keepGoing}
        />
        <AppButton
          label={tr('guardrail.wrapUp')}
          variant="ghost"
          size="md"
          fullWidth
          onPress={wrapUp}
        />
      </View>
    </Animated.View>
  );
}
