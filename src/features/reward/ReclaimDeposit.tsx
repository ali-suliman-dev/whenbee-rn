import { useEffect } from 'react';
import { View, TextInput, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// ReclaimDeposit — the tangible-payoff beat (DESIGN §2.6, between honey + cap).
//
// An amber "+Nm reclaimed" chip, then the lifetime Reclaim total counts up from
// the pre-deposit number to the new one. Calm and earned — a small pop-and-settle
// on the chip, a 700ms count-up on the total. Never slot-machine.
//
// Rendered ONLY when reclaimDeltaMin >= 1 (the caller guards this — no "+0m").
// Reduce-motion → chip just fades in, the total sets to its final value instantly.
//
// The count-up uses the house AnimatedNumeral trick (see timer/AnimatedNumeral):
// an AnimatedTextInput whose `text` prop is written on the UI thread via
// useAnimatedProps, so the number ticks up with zero per-frame React re-render.
// ──────────────────────────────────────────────────────────────────────────────

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Worklet-safe twin of engine `formatReclaim` — 860 → "14h 20m", 35 → "35m". */
function formatReclaimWorklet(totalMinutes: number): string {
  'worklet';
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ReclaimDeposit({
  reclaimDeltaMin,
  reclaimFrom,
  reclaimTo,
  delayMs = 0,
}: {
  reclaimDeltaMin: number;
  reclaimFrom: number;
  reclaimTo: number;
  /** Stagger offset so this beat lands AFTER the honey fill (escalating order). */
  delayMs?: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const chipScale = useSharedValue(reducedMotion ? 1 : 0.9);
  const chipOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const total = useSharedValue(reducedMotion ? reclaimTo : reclaimFrom);

  useEffect(() => {
    if (reducedMotion) {
      chipScale.value = 1;
      chipOpacity.value = 1;
      total.value = reclaimTo;
      return;
    }
    // Chip: fade in + a small pop that overshoots to 1.08 then springs home.
    chipOpacity.value = withDelay(delayMs, withTiming(1, { duration: t.motion.base }));
    chipScale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.08, { duration: t.motion.press }),
        withSpring(1, t.motion.spring),
      ),
    );
    // Total: count up from the pre-deposit number to the new lifetime total.
    total.value = withDelay(
      delayMs,
      withTiming(reclaimTo, {
        duration: t.motion.pulse,
        easing: t.motion.easing.standard,
      }),
    );
  }, [
    reducedMotion,
    reclaimFrom,
    reclaimTo,
    delayMs,
    chipScale,
    chipOpacity,
    total,
    t.motion.base,
    t.motion.press,
    t.motion.pulse,
    t.motion.spring,
    t.motion.easing.standard,
  ]);

  const chipAnim = useAnimatedStyle(() => ({
    opacity: chipOpacity.value,
    transform: [{ scale: chipScale.value }],
  }));

  const totalProps = useAnimatedProps(
    () =>
      ({ text: formatReclaimWorklet(total.value) } as unknown as Partial<
        import('react-native').TextInputProps
      >),
  );

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[3],
    marginTop: t.space[2],
  };
  const chip: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1],
  };
  const chipText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
  };
  const totalStyle: TextStyle = {
    ...(type.multiplier as unknown as TextStyle),
    color: t.colors.amberText,
    padding: 0,
  };

  const a11yTotal = formatReclaimWorklet(reclaimTo);

  return (
    <View style={row} accessibilityLabel={`Reclaimed ${reclaimDeltaMin} minutes, ${a11yTotal} banked`}>
      <Animated.View style={[chip, chipAnim]}>
        <AppText style={chipText}>+{reclaimDeltaMin}m reclaimed</AppText>
      </Animated.View>
      <AnimatedTextInput
        editable={false}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        underlineColorAndroid="transparent"
        defaultValue={a11yTotal}
        style={totalStyle}
        animatedProps={totalProps}
      />
    </View>
  );
}
