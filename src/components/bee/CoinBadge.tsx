import { useEffect, useCallback, type ReactNode } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';

// ──────────────────────────────────────────────────────────────────────────────
// CoinBadge — the small floating pill beside the Whenbee, built on AppButton's
// coin-edge depth (a solid darker edge View peeking below the surface) so it reads
// as a tactile token, not a flat label. Display-only — never pressable.
//
// Two layers of motion: a Playful pop-in on mount (spring scale + lift, joy), then
// a calm ambient bob (sine, phase-offset from the bee via `delay`). Reduce-motion
// → final state, no travel.
//
// tone: 'amber' = nectar / ripen / upgrade (▲); 'indigo' = aha / insight.
// Pass `label` for text ("+1 nectar", "aha") or `icon` for a glyph (▲).
// ──────────────────────────────────────────────────────────────────────────────

export function CoinBadge({
  tone,
  label,
  icon,
  delay = 0,
}: {
  tone: 'amber' | 'indigo';
  label?: string;
  icon?: ReactNode;
  /** Phase-offset (ms) for the bob loop, so coin + bee don't bob in lockstep. */
  delay?: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const bg = tone === 'amber' ? t.colors.accent : t.colors.primary;
  const edge = tone === 'amber' ? t.colors.accentEdge : t.colors.primaryEdge;
  const fg = tone === 'amber' ? t.colors.onAmber : t.colors.onIndigo;

  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    // Pop-in: scale + opacity settle with a touch of overshoot (Playful).
    appear.set(withSpring(1, t.motion.spring));
  }, [reducedMotion, appear, t.motion.spring]);

  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      bob.set(
        withDelay(
          t.motion.reveal + delay,
          withRepeat(
            withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }),
            -1,
            true,
          ),
        ),
      );
      return () => {
        cancelAnimation(bob);
        bob.set(0);
      };
    }, [bob, t.motion.reveal, t.motion.float, t.motion.easing.calm, delay]),
  );

  const animStyle = useAnimatedStyle(() => {
    const a = appear.get();
    return {
      opacity: a,
      transform: [
        { scale: 0.6 + a * 0.4 },
        { translateY: (1 - a) * t.burst.coinLift - bob.get() * t.burst.coinBob },
      ],
    };
  });

  const wrapper: ViewStyle = { paddingBottom: t.burst.coinEdge };
  const edgeBase: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: t.burst.coinEdge,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: edge,
  };
  const surface: ViewStyle = {
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: bg,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1.5],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: t.space[1],
  };
  const text: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: fg,
  };

  return (
    <Animated.View style={[wrapper, animStyle]}>
      <View style={edgeBase} />
      <View style={surface}>
        {icon ?? null}
        {label ? <AppText style={text}>{label}</AppText> : null}
      </View>
    </Animated.View>
  );
}
