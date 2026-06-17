import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
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
import { BeeMascot } from '@/src/components/BeeMascot';
import { type } from '@/src/theme/typography';
import type { CompanionStage, DriftHealth } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeAvatar — the companion, now stage-driven (Part 2 Group E). It renders the
// ONE base BeeMascot art and lets the 6-stage growth speak through motion + glow:
//
//   • Mount: a Playful spring LIFT whose amplitude scales with stage (a higher hop
//     for a more-present bee), then a calm sine FLOAT bob at the same per-stage
//     amplitude (companion.floatLift token). Joy, never urgency.
//   • driftHealth 'curious' ONLY adds a tiny rotational wobble — a gentle "worth a
//     re-check" wave, never a sad/wilt state (positive-only invariant).
//   • REDUCE-MOTION: collapse to a plain fade-in, no travel (matches CoinBadge).
//
// Art + motion only (plus an optional name). No caption line — the ring badge and
// the labeled zones below carry the words.
// ──────────────────────────────────────────────────────────────────────────────

export function WhenbeeAvatar({
  stage,
  seed,
  driftHealth = 'settled',
  name,
  glow = true,
}: {
  stage: CompanionStage;
  seed: number;
  driftHealth?: DriftHealth;
  name?: string;
  /** Forwarded to BeeMascot. When false, the amber/drift glow halo is not rendered.
   *  Pass glow={false} when the avatar sits inside HoneyRing where the ring arc
   *  provides the visual focus and a glow halo would add clutter. */
  glow?: boolean;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const curious = driftHealth === 'curious';

  // noUncheckedIndexedAccess: floatLift may be undefined-at-index → fall back to the
  // gentlest amplitude so a bad stage still breathes calmly rather than going still.
  const lift = t.companion.floatLift[stage - 1] ?? t.companion.floatLift[0] ?? 2;

  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const bob = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    // Mount lift: spring up + fade in (Playful, a touch of overshoot → joy).
    appear.set(withSpring(1, t.motion.spring));
    // Ambient float: calm sine, ± lift px, phased after the lift lands.
    bob.set(
      withDelay(
        t.motion.reveal,
        withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
      ),
    );
    // Curious wobble: a slow, tiny rotational sway — a friendly wave, not distress.
    if (curious) {
      wobble.set(
        withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
      );
    }
  }, [
    reducedMotion,
    curious,
    appear,
    bob,
    wobble,
    t.motion.spring,
    t.motion.reveal,
    t.motion.float,
    t.motion.easing.calm,
  ]);

  const beeStyle = useAnimatedStyle(() => {
    const a = appear.get();
    return {
      opacity: a,
      transform: [
        // Mount lift collapses as `appear` settles; ambient bob rides ± lift px.
        { translateY: (1 - a) * lift - bob.get() * lift },
        // Curious wobble: ±2° gentle sway, only when curious (wobble stays 0 otherwise).
        { rotate: `${(wobble.get() * 2 - 1) * 2}deg` },
      ],
    };
  });

  const wrap: ViewStyle = { alignItems: 'center', gap: t.space[2] };
  const nameStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };

  return (
    <View style={wrap}>
      <Animated.View style={beeStyle}>
        <BeeMascot size={t.burst.bee} variant={`stage-${stage}`} seed={seed} glow={glow} />
      </Animated.View>
      {name ? <AppText style={nameStyle}>{name}</AppText> : null}
    </View>
  );
}
