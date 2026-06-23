import { useEffect } from 'react';
import { Modal, View, Pressable, TextInput, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon, Path } from 'react-native-svg';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';

// ──────────────────────────────────────────────────────────────────────────────
// GraduationMoment — the one-time reward when a category first earns 'honest'.
//
// Concept: the "still learning" calibration bar the user came from FINISHES — the
// honey track fills to 100% and a hex cap seals the end. Flat-tactical (solid
// surface, hairline, coin-edge CTA, honey hex) — no glass, no blur.
//
// Fires exactly once per category, ever (the hook + kv ledger gate it). Calm,
// premium reveal: card settles (opacity + a hair of scale, no spring overshoot),
// the number climbs (only ever UP — no guilt), the bar fills with the honey curve,
// supporting text fades in (opacity only — never slides). The CTA is static.
// Reduce-motion → final state, no travel. Tap anywhere / Nice to dismiss.
// ──────────────────────────────────────────────────────────────────────────────

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Flat-top honey hex with a coin-edge + check — the cap that seals the bar's end.
function HexCap({ size, edge, fill, edgeColor, check }: {
  size: number;
  edge: number;
  fill: string;
  edgeColor: string;
  check: string;
}) {
  const pts = (dy: number) =>
    `${size * 0.25},${dy} ${size * 0.75},${dy} ${size},${dy + size * 0.5} ${size * 0.75},${dy + size} ${size * 0.25},${dy + size} 0,${dy + size * 0.5}`;
  return (
    <Svg width={size} height={size + edge}>
      <Polygon points={pts(edge)} fill={edgeColor} />
      <Polygon points={pts(0)} fill={fill} />
      <Path
        d={`M${size * 0.3} ${size * 0.52} L${size * 0.45} ${size * 0.68} L${size * 0.73} ${size * 0.36}`}
        stroke={check}
        strokeWidth={size * 0.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function GraduationMoment({
  honestMinutes,
  multiplier,
  sampleSize,
  onDone,
}: {
  honestMinutes: number;
  /** Personal bias factor — shown in the proof chip as the honest "×". Optional. */
  multiplier?: number;
  /** Real completed runs behind the number — the credibility behind "honest". */
  sampleSize?: number;
  onDone: () => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // count → climbing integer; appear → card settle; fill → honey bar 0→1.
  const count = useSharedValue(reducedMotion ? honestMinutes : 0);
  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const fill = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    haptics.success(); // a win, never a warning — fire once on mount.
    if (reducedMotion) return;
    appear.set(withTiming(1, { duration: t.motion.sheet, easing: t.motion.easing.premium }));
    count.set(withTiming(honestMinutes, { duration: t.motion.draw, easing: t.motion.easing.honey }));
    // The bar wells up to full a beat after the card lands (the honey curve).
    fill.set(withDelay(160, withTiming(1, { duration: t.motion.honeyFill, easing: t.motion.easing.honey })));
  }, [reducedMotion, honestMinutes, appear, count, fill, t.motion]);

  const numberProps = useAnimatedProps(
    () =>
      ({ text: `~${Math.round(count.get())}` } as unknown as Partial<
        import('react-native').TextInputProps
      >),
  );

  const cardAnim = useAnimatedStyle(() => {
    const a = appear.get();
    return { opacity: a, transform: [{ scale: 0.94 + a * 0.06 }] };
  });
  const fillAnim = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  const capAnim = useAnimatedStyle(() => {
    const f = fill.get();
    return { left: `${f * 100}%`, opacity: f };
  });

  const showProof = typeof multiplier === 'number' && typeof sampleSize === 'number';
  const runsLabel = typeof sampleSize === 'number' ? `${sampleSize}` : 'enough';

  // Content fades in (opacity only — never a slide). CTA is exempt (buttons appear
  // at full opacity, never animated in).
  const fade = (delay: number) =>
    reducedMotion ? undefined : FadeIn.duration(t.motion.base).delay(delay);

  const CAP = t.space[5]; // hex-cap box size (smaller, seals the thin bar)
  const CAP_EDGE = t.burst.coinEdge; // its coin-edge depth

  const scrim: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.space[6],
  };
  const content: ViewStyle = { width: '100%', maxWidth: t.space[16] * 6, alignItems: 'stretch' };
  const ctaWrap: ViewStyle = { width: '100%', marginTop: t.space[2] };
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingVertical: t.space[6],
    paddingHorizontal: t.space[6],
    gap: t.space[4],
    alignItems: 'center',
  };
  const headGroup: ViewStyle = { alignItems: 'center', gap: t.space[4] };
  const numberRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const textGroup: ViewStyle = { alignItems: 'center', gap: t.space[1] };

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), fontSize: t.fontSize['2xs'], color: t.colors.amberText, textAlign: 'center' };
  const numberStyle: TextStyle = {
    ...(type.honestNumberHero as unknown as TextStyle),
    color: t.colors.ink,
    padding: 0,
    textAlign: 'center',
  };
  const unitStyle: TextStyle = {
    ...(type.honestNumberMd as unknown as TextStyle),
    fontSize: Math.round(t.fontSize.honestHero * 0.46),
    color: t.colors.inkSoft,
  };
  const title: TextStyle = { ...(type.titleSm as unknown as TextStyle), color: t.colors.ink, textAlign: 'center' };
  const sub: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, textAlign: 'center' };

  // Honey-fill track — sits at 84% width so the cap can seal its end with room.
  const track: ViewStyle = {
    width: '84%',
    height: t.space[2.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    alignSelf: 'center',
    marginVertical: t.space[3],
  };
  const trackFill: ViewStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };
  const capWrap: ViewStyle = {
    position: 'absolute',
    top: '50%',
    marginTop: -(CAP + CAP_EDGE) / 2,
    marginLeft: -CAP / 2,
  };

  const chip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    alignSelf: 'center',
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    paddingVertical: t.space[1.5],
    paddingHorizontal: t.space[3],
  };
  const chipText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.inkSoft };
  const chipMult: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.amberText };
  const chipDot: ViewStyle = {
    width: t.space[1],
    height: t.space[1],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.inkFaint,
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={scrim} onPress={onDone} accessibilityRole="button" accessibilityLabel="Dismiss">
        {/* Neutral cool darken behind — solid color, never samples the warm content
            (a blur here smears the amber-heavy screen into a red wash). Flat card on top. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.scrimStrong }]} pointerEvents="none" />
        <Animated.View style={content}>
          <Animated.View style={[card, cardAnim]} accessibilityViewIsModal>
            <View style={headGroup}>
              <Animated.View entering={fade(120)}>
                <AppText style={eyebrow}>CALIBRATION COMPLETE</AppText>
              </Animated.View>
              <View style={numberRow}>
                <AnimatedTextInput
                  editable={false}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  underlineColorAndroid="transparent"
                  defaultValue={`~${honestMinutes}`}
                  style={numberStyle}
                  animatedProps={numberProps}
                />
                <AppText style={unitStyle}>min</AppText>
              </View>
            </View>

            <View style={track}>
              <Animated.View style={[trackFill, fillAnim]} />
              <Animated.View style={[capWrap, capAnim]}>
                <HexCap
                  size={CAP}
                  edge={CAP_EDGE}
                  fill={t.colors.accent}
                  edgeColor={t.colors.accentEdge}
                  check={t.colors.onAmber}
                />
              </Animated.View>
            </View>

            <Animated.View style={textGroup} entering={fade(220)}>
              <AppText
                style={title}
                accessibilityRole="header"
                accessibilityLabel={`Now an honest number. About ${honestMinutes} minutes.`}
              >
                This number&apos;s honest now
              </AppText>
              <AppText style={sub}>The learning bar filled — {runsLabel} real runs in.</AppText>
            </Animated.View>

            {showProof ? (
              <Animated.View entering={fade(300)} style={chip}>
                <AppText style={chipText}>{sampleSize} real runs</AppText>
                <View style={chipDot} />
                <AppText style={chipMult}>{multiplier.toFixed(1)}×</AppText>
              </Animated.View>
            ) : null}

            <View style={ctaWrap}>
              <AppButton label="Nice" variant="amber" onPress={onDone} fullWidth />
            </View>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
