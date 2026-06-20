import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PresenceRingTeaser — locked non-Pro state in Settings → Presence.
//
// Shows a static finish-time ring preview (react-native-svg Circle track + arc)
// with a one-line value statement and a primary CTA.
//
// `onCtaPress` is injected by the parent (usePresenceSection feature hook) so
// this component never imports services directly (ESLint boundary: components
// must not import @/src/services/* or @/src/db/*).
//
// Motion: one-time entrance fill of the arc on mount via Reanimated withTiming,
// using the `honeyFill` duration and `easing.honey` curve. ENTERING-ONLY — never
// sets an `exiting` prop (SIGABRTs on Fabric). Skip under ReduceMotion (renders
// at final state immediately). Shared values accessed only via .get()/.set().
// ──────────────────────────────────────────────────────────────────────────────

// Ring geometry — a compact preview ring sized for the Settings card.
const RING_SIZE = 72;
const STROKE = 5;
const R = (RING_SIZE - STROKE) / 2;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

// Static demo fill: ~65% — enough to read as "meaningfully progressed" without
// implying a specific task or time. Fixed so the teaser is inert, not user data.
const DEMO_FILL = 0.65;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function PresenceRingTeaser({ onCtaPress }: { onCtaPress: () => void }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // 0→DEMO_FILL, one-time on mount. Under ReduceMotion, start at the final state.
  const fillFrac = useSharedValue(reducedMotion ? DEMO_FILL : 0);

  useEffect(() => {
    if (reducedMotion) {
      // Already at final state — nothing to animate.
      return;
    }
    fillFrac.set(
      withTiming(DEMO_FILL, {
        duration: t.motion.honeyFill,
        easing: t.motion.easing.honey,
      }),
    );
    // Runs once on mount; reducedMotion and token values are stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - fillFrac.get()),
  }));

  // ── Layout ────────────────────────────────────────────────────────────────
  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[4],
    paddingTop: t.space[3],
  };

  const ringContainer: ViewStyle = {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const textBlock: ViewStyle = {
    flex: 1,
    gap: t.space[2],
  };

  const bodyStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const clockStyle: TextStyle = {
    ...(type.bigNumber as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };

  return (
    <View>
      <View style={container}>
        {/* Static finish-time ring preview */}
        <View style={ringContainer}>
          <Svg width={RING_SIZE} height={RING_SIZE} accessible={false}>
            {/* Track */}
            <Circle
              cx={CX}
              cy={CY}
              r={R}
              stroke={t.colors.ringTrack}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Animated arc — fills clockwise from 12 o'clock */}
            <AnimatedCircle
              cx={CX}
              cy={CY}
              r={R}
              stroke={t.colors.accent}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              originX={CX}
              originY={CY}
              rotation={-90}
              animatedProps={arcProps}
            />
          </Svg>
          {/* Demo clock label centred inside the ring */}
          <View
            style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}
            pointerEvents="none"
          >
            <AppText style={clockStyle}>7:10</AppText>
          </View>
        </View>

        {/* Value statement */}
        <View style={textBlock}>
          <AppText style={bodyStyle}>
            Watch the ring fill toward your real finish on the Lock Screen.
          </AppText>
        </View>
      </View>

      {/* Primary CTA */}
      <View style={{ marginTop: t.space[3] }}>
        <AppButton
          label="Unlock the honest ring"
          onPress={onCtaPress}
          variant="amber"
          fullWidth
        />
      </View>
    </View>
  );
}
