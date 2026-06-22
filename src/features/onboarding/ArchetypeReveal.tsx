import { View, Text, Platform, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
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
// honey→indigo card (no border) with the bee crest + gold coin-hex seal, an amber
// eyebrow, the archetype title, the honey multiplier stat, and a warm blurb.
// Continue is pinned at the SCREEN BOTTOM, out of the card (one primary CTA),
// styled exactly like every other onboarding Continue (default size — never lg).
//
// Motion is CALM by rule: the card fades + settles a touch in scale (a gentle
// resize, NEVER a slide-up or bounce), the bee carries the life via its own
// path animation, and the text fades in. Nothing translates up into place and
// nothing springs/bounces; the button is never animated. (See CLAUDE.md anim rule.)
// Entering-only (no exit — Fabric SIGABRT). Reduced motion → final state.
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

  // Entering-only. The card fades; the crest ILLUSTRATION scales in (a resize, not a
  // slide/bounce) while the bee animates its own paths; text fades. No translateY,
  // no spring, button never animates.
  const cardOpacity = useSharedValue(reduced ? 1 : 0);
  const crestOpacity = useSharedValue(reduced ? 1 : 0);
  const crestScale = useSharedValue(reduced ? 1 : 0.9);
  const eyebrow = useSharedValue(reduced ? 1 : 0);
  const titleV = useSharedValue(reduced ? 1 : 0);
  const stat = useSharedValue(reduced ? 1 : 0);
  const blurbV = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const out = { duration: t.motion.reveal, easing: t.motion.easing.out };
    cardOpacity.set(withTiming(1, out));
    crestOpacity.set(withTiming(1, out));
    crestScale.set(withTiming(1, out));
    const fade = (sv: typeof eyebrow, delay: number) =>
      sv.set(withDelay(delay, withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard })));
    fade(eyebrow, 220);
    fade(titleV, 320);
    fade(stat, 420);
    fade(blurbV, 540);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.get() }));
  const crestStyle = useAnimatedStyle(() => ({
    opacity: crestOpacity.get(),
    transform: [{ scale: crestScale.get() }],
  }));
  const eyebrowAnim = useAnimatedStyle(() => ({ opacity: eyebrow.get() }));
  const titleAnim = useAnimatedStyle(() => ({ opacity: titleV.get() }));
  // Subtle resize on the headline stat — a gentle settle, never a bounce.
  const statAnim = useAnimatedStyle(() => ({ opacity: stat.get(), transform: [{ scale: 0.96 + stat.get() * 0.04 }] }));
  const blurbAnim = useAnimatedStyle(() => ({ opacity: blurbV.get() }));

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
      ios: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: t.shadow.lift.radius, shadowOffset: { width: 0, height: t.shadow.lift.offset } },
      default: { elevation: t.shadow.lift.elevation },
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
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <Defs>
            <LinearGradient id="revealGrad" x1="0" y1="0" x2="0.35" y2="1">
              <Stop offset="0" stopColor={t.reveal.gradTop} />
              <Stop offset="0.5" stopColor={t.reveal.gradMid} />
              <Stop offset="1" stopColor={t.reveal.gradBot} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#revealGrad)" />
        </Svg>

        <Animated.View style={crestStyle}>
          <ArchetypeCrest />
        </Animated.View>
        <Animated.Text style={[eyebrowStyle, eyebrowAnim]}>YOUR TIME PERSONALITY</Animated.Text>
        <Animated.Text style={[titleStyle, titleAnim]}>{title}</Animated.Text>
        <Animated.View style={[multRow, statAnim]}>
          <Text style={multStyle}>{multiplier.toFixed(1)}×</Text>
          <Text style={multCaption}>your guess, on average</Text>
        </Animated.View>
        <Animated.Text style={[blurbStyle, blurbAnim]}>{blurb}</Animated.Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <AppButton label="Continue →" variant="indigo" fullWidth onPress={onContinue} />
    </View>
  );
}
