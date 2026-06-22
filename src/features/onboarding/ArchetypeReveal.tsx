import { View, Text, Platform, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useEffect } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { ArchetypeCrest } from './ArchetypeCrest';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeReveal — the "collectible crest" payoff. A rich, mode-independent
// honey→indigo card (no border) with the bee crest + gold coin-hex seal, an
// amber eyebrow, the archetype title, the honey multiplier stat, and a warm
// blurb. Continue is pinned at the SCREEN BOTTOM, out of the card (one primary
// CTA per screen). The whole thing rises in, a foil light sweeps once, and the
// text cascades. Entering-only (no exit — Fabric SIGABRT). Reduced motion → final.
// ──────────────────────────────────────────────────────────────────────────────

interface ArchetypeRevealProps {
  title: string;
  blurb: string;
  multiplier: number;
  onContinue: () => void;
}

export function ArchetypeReveal({
  title,
  blurb,
  multiplier,
  onContinue,
}: ArchetypeRevealProps): React.JSX.Element {
  const t = useTheme();
  const reduced = useReducedMotion();

  // ── entering-only shared values ────────────────────────────────────────────
  const cardOpacity = useSharedValue(reduced ? 1 : 0);
  const cardY = useSharedValue(reduced ? 0 : 22);
  const cardScale = useSharedValue(reduced ? 1 : 0.96);
  const shineX = useSharedValue(reduced ? 1.4 : -0.6); // fraction of card width
  const eyebrow = useSharedValue(reduced ? 1 : 0);
  const titleV = useSharedValue(reduced ? 1 : 0);
  const stat = useSharedValue(reduced ? 1 : 0);
  const blurbV = useSharedValue(reduced ? 1 : 0);
  const btn = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const out = { duration: t.motion.reveal, easing: t.motion.easing.out };
    cardOpacity.set(withTiming(1, out));
    cardY.set(withTiming(0, out));
    cardScale.set(withTiming(1, out));
    shineX.set(withDelay(220, withTiming(1.4, { duration: t.motion.slow * 2, easing: t.motion.easing.standard })));
    const rise = (sv: typeof eyebrow, delay: number) =>
      sv.set(withDelay(delay, withTiming(1, { duration: t.motion.base, easing: t.motion.easing.out })));
    rise(eyebrow, 300);
    rise(titleV, 380);
    stat.set(withDelay(460, withSpring(1, t.motion.spring)));
    rise(blurbV, 560);
    rise(btn, 660);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get(),
    transform: [{ translateY: cardY.get() }, { scale: cardScale.get() }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: shineX.get() > -0.4 && shineX.get() < 1.3 ? 1 : 0,
    transform: [{ translateX: `${shineX.get() * 100}%` }, { rotate: '18deg' }],
  }));
  const riseY = t.space[2.5];
  const eyebrowAnim = useAnimatedStyle(() => ({ opacity: eyebrow.get(), transform: [{ translateY: (1 - eyebrow.get()) * riseY }] }));
  const titleAnim = useAnimatedStyle(() => ({ opacity: titleV.get(), transform: [{ translateY: (1 - titleV.get()) * riseY }] }));
  const statAnim = useAnimatedStyle(() => ({ opacity: stat.get(), transform: [{ scale: 0.9 + stat.get() * 0.1 }] }));
  const blurbAnim = useAnimatedStyle(() => ({ opacity: blurbV.get(), transform: [{ translateY: (1 - blurbV.get()) * riseY }] }));
  const btnAnim = useAnimatedStyle(() => ({ opacity: btn.get() }));

  // ── styles (tokens only) ─────────────────────────────────────────────────────
  const card: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: t.reveal.gradBot,
    paddingHorizontal: t.space[6],
    paddingTop: t.space[8],
    paddingBottom: t.space[6],
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: t.space[6], shadowOffset: { width: 0, height: t.space[4] } },
      default: { elevation: 8 },
    }),
  };
  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.accent, textAlign: 'center' };
  const titleStyle: TextStyle = { ...(type.title as unknown as TextStyle), color: t.reveal.inkOn, textAlign: 'center', marginTop: t.space[2] };
  const multRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[1.5], marginTop: t.space[4] };
  const multStyle: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.brand.honeyFill };
  const multCaption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.reveal.blurbOn, maxWidth: t.size.shareCard / 4 };
  const blurbStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.reveal.blurbOn, textAlign: 'center', marginTop: t.space[5], maxWidth: t.size.shareCard * 0.82 };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[card, cardStyle]}>
        {/* Full-bleed honey→indigo gradient (clipped by the card's rounded overflow). */}
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <Defs>
            <LinearGradient id="revealGrad" x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={t.reveal.gradTop} />
              <Stop offset="0.45" stopColor={t.reveal.gradMid} />
              <Stop offset="1" stopColor={t.reveal.gradBot} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#revealGrad)" />
        </Svg>

        {/* Foil shine — a soft diagonal light that sweeps once across the card. */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: -t.space[10], bottom: -t.space[10], width: '40%', backgroundColor: t.colors.shineOverlay, opacity: t.opacity.disabled },
            shineStyle,
          ]}
        />

        <ArchetypeCrest />
        <Animated.Text style={[eyebrowStyle, eyebrowAnim]}>YOUR TIME PERSONALITY</Animated.Text>
        <Animated.Text style={[titleStyle, titleAnim]}>{title}</Animated.Text>
        <Animated.View style={[multRow, statAnim]}>
          <Text style={multStyle}>{multiplier.toFixed(1)}×</Text>
          <Text style={multCaption}>your guess, on average</Text>
        </Animated.View>
        <Animated.Text style={[blurbStyle, blurbAnim]}>{blurb}</Animated.Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View style={btnAnim}>
        <AppButton label="Continue →" variant="indigo" size="lg" fullWidth onPress={onContinue} />
      </Animated.View>
    </View>
  );
}
