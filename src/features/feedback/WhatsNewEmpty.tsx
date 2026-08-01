import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type TextStyle } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { BeeMascot } from '@/src/components/BeeMascot';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// WhatsNewEmpty — "Resting bee" empty state for the What's New drawer (no
// changelog entries yet). A dozing companion with a soft "zzz" and warm copy
// that ties the empty state back to the feedback loop, so it reads as "nothing
// YET" rather than a dead end. See docs/product/specs/2026-07-17-ui-polish-batch.md,
// Workstream 3.
//
// Motion — ambient, premium restraint (no entrance, nothing slides in):
//  • breath: the bee scales 1 → 1.03 on a sine in/out loop (t.motion.beeBreath per
//    half-cycle ≈ a resting breath rate). Scale only, no travel, no overshoot.
//  • zzz: each "z" rises a few points and fades on its own loop, staggered by a
//    third of a cycle so they never peak together — the bee's exhale, not a badge.
// Reduced motion → the final static state (bee at rest, all three z's visible).
// ──────────────────────────────────────────────────────────────────────────────

/** Peak of the breath. 3% — visible as life, invisible as animation. */
const BREATH_SCALE = 1.03;

/** How far a "z" drifts up over its cycle, as a fraction of the art size. */
const ZZZ_RISE = 0.06;

export function WhatsNewEmpty() {
  const t = useTheme();
  const { t: tr } = useTranslation('feedback');
  const reduced = useReducedMotion();
  const ART_SIZE = t.size.emptyArt;

  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      breath.set(0);
      return;
    }
    breath.set(
      withRepeat(
        withTiming(1, { duration: t.motion.beeBreath, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(breath);
  }, [reduced, breath, t.motion.beeBreath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.get() * (BREATH_SCALE - 1) }],
  }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4] }}>
      <View style={{ width: ART_SIZE, height: ART_SIZE }}>
        <Animated.View style={breathStyle}>
          <BeeMascot size={ART_SIZE} sleepy glow={false} />
        </Animated.View>
        {/* Each "z" gets its own overlay Svg + Animated.View: BeeMascot renders its
            own <Svg> and takes no children, and animating the wrapper View (rather
            than SVG props) keeps the loop on plain, reliable style transforms. */}
        <Zzz index={0} artSize={ART_SIZE} x={0.78} y={0.28} fontSize={t.fontSize.lg} peak={1} />
        <Zzz index={1} artSize={ART_SIZE} x={0.88} y={0.18} fontSize={t.fontSize.md} peak={0.7} />
        <Zzz index={2} artSize={ART_SIZE} x={0.97} y={0.1} fontSize={t.fontSize.sm} peak={0.45} />
      </View>
      <View style={{ alignItems: 'center', gap: t.space[1.5] }}>
        <AppText style={{ ...(type.titleSm as TextStyle), color: t.colors.ink }}>{tr('whatsNewEmpty.title')}</AppText>
        <AppText
          style={{
            ...(type.bodySm as TextStyle),
            color: t.colors.inkSoft,
            textAlign: 'center',
            maxWidth: t.size.emptyCopy,
          }}
        >
          {tr('whatsNewEmpty.body')}
        </AppText>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Zzz — one drifting "z". Opacity-led (it fades in, holds, fades out) with a
// small upward drift; decreasing `peak` per z keeps the trio reading as one
// breath receding, exactly as the static version did.
// ──────────────────────────────────────────────────────────────────────────────

function Zzz({
  index,
  artSize,
  x,
  y,
  fontSize,
  peak,
}: {
  index: number;
  artSize: number;
  /** Anchor as a fraction of the art box — matches the original static layout. */
  x: number;
  y: number;
  fontSize: number;
  /** Resting opacity for this z, and the top of its fade. */
  peak: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.set(0);
      return;
    }
    progress.set(
      withDelay(
        index * t.motion.zzzStagger,
        withRepeat(
          withTiming(1, { duration: t.motion.zzz, easing: Easing.inOut(Easing.sin) }),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(progress);
  }, [reduced, progress, index, t.motion.zzz, t.motion.zzzStagger]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    // Fade up over the first third, hold, fade out over the last third — a rise
    // that never blinks on or off at the loop seam.
    const fade = p < 0.33 ? p / 0.33 : p > 0.66 ? (1 - p) / 0.34 : 1;
    return {
      opacity: reduced ? peak : peak * fade,
      transform: [{ translateY: reduced ? 0 : -p * artSize * ZZZ_RISE }],
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, style]}>
      <Svg width={artSize} height={artSize}>
        <SvgText
          x={artSize * x}
          y={artSize * y}
          fill={t.colors.accent}
          fontSize={fontSize}
          fontWeight={t.fontWeight.bold}
        >
          z
        </SvgText>
      </Svg>
    </Animated.View>
  );
}
