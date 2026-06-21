import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Polygon, Ellipse, Rect, Circle, RadialGradient, Defs, Stop } from 'react-native-svg';
import { useEffect } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeReveal — the calm, premium payoff moment in onboarding.
//
// Entrance choreography (Premium archetype from motion-design skill):
//   0ms   bee + glow: translateY 24→0, opacity 0→1, 600ms, honey easing
//  200ms  title:      translateY 16→0, opacity 0→1, 360ms, out easing
//  380ms  multiplier: scale 0.85→1, opacity 0→1, 360ms, honey easing
//  500ms  blurb + sharpening note: translateY 8→0, opacity 0→1, 220ms
//  600ms  button: opacity 0→1, 220ms
//
// Reduced-motion → all values jump to end state with no travel.
// Entering-only (no exiting — per project constraint; Fabric SIGABRT on exit).
// ──────────────────────────────────────────────────────────────────────────────

// Re-uses BeeGlyph visual language from ArchetypeHero (Archetype.tsx).
function BeeGlyph({ size }: { size: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Polygon
        points="23,4 39,13 39,33 23,42 7,33 7,13"
        fill={t.colors.primarySoft}
        stroke={t.colors.primary}
        strokeWidth={1.5}
      />
      <Ellipse cx={23} cy={24} rx={8} ry={9} fill={t.colors.primary} />
      <Rect x={16} y={20} width={14} height={2.4} rx={1.2} fill={t.colors.accent} />
      <Rect x={16} y={25} width={14} height={2.4} rx={1.2} fill={t.colors.accent} />
      <Circle cx={20} cy={17} r={1.4} fill={t.colors.ink} />
      <Circle cx={26} cy={17} r={1.4} fill={t.colors.ink} />
    </Svg>
  );
}

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
  const reducedMotion = useReducedMotion();

  // ── shared values (entering-only; no exiting to avoid Fabric SIGABRT) ───────
  const beeOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const beeTranslateY = useSharedValue(reducedMotion ? 0 : 24);
  const titleOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const titleTranslateY = useSharedValue(reducedMotion ? 0 : 16);
  const multOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const multScale = useSharedValue(reducedMotion ? 1 : 0.85);
  const blurbOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const blurbTranslateY = useSharedValue(reducedMotion ? 0 : 8);
  const btnOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    // Bee + glow: rises and settles (Premium — slow, honey easing)
    beeOpacity.set(withTiming(1, { duration: t.motion.reveal, easing: t.motion.easing.honey }));
    beeTranslateY.set(withTiming(0, { duration: t.motion.reveal, easing: t.motion.easing.honey }));

    // Title: fades + rises after bee lands
    titleOpacity.set(
      withDelay(200, withTiming(1, { duration: t.motion.slow, easing: t.motion.easing.out })),
    );
    titleTranslateY.set(
      withDelay(200, withTiming(0, { duration: t.motion.slow, easing: t.motion.easing.out })),
    );

    // Multiplier: scale-pops into view
    multOpacity.set(
      withDelay(380, withTiming(1, { duration: t.motion.slow, easing: t.motion.easing.honey })),
    );
    multScale.set(
      withDelay(380, withTiming(1, { duration: t.motion.slow, easing: t.motion.easing.honey })),
    );

    // Blurb + sharpening note: quiet fade-rise
    blurbOpacity.set(
      withDelay(500, withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard })),
    );
    blurbTranslateY.set(
      withDelay(500, withTiming(0, { duration: t.motion.base, easing: t.motion.easing.standard })),
    );

    // Button: fades in last so it never competes with the reveal
    btnOpacity.set(
      withDelay(600, withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard })),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── animated styles ──────────────────────────────────────────────────────────
  const beeAnimStyle = useAnimatedStyle(() => ({
    opacity: beeOpacity.get(),
    transform: [{ translateY: beeTranslateY.get() }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.get(),
    transform: [{ translateY: titleTranslateY.get() }],
  }));

  const multAnimStyle = useAnimatedStyle(() => ({
    opacity: multOpacity.get(),
    transform: [{ scale: multScale.get() }],
  }));

  const blurbAnimStyle = useAnimatedStyle(() => ({
    opacity: blurbOpacity.get(),
    transform: [{ translateY: blurbTranslateY.get() }],
  }));

  const btnAnimStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.get(),
  }));

  // ── styles (tokens only — no inline raw numbers) ─────────────────────────────
  const card: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.share,
    borderColor: t.colors.border,
    padding: t.space[5],
    gap: t.space[2],
  };

  const eyebrowStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.primary,
  };

  const titleStyle: TextStyle = {
    ...(type.subtitle as unknown as TextStyle),
    color: t.colors.ink,
    marginTop: t.space[1],
  };

  const multRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: t.space[1.5],
  };

  const multStyle: TextStyle = {
    ...(type.honestNumberLg as unknown as TextStyle),
    color: t.colors.accent,
  };

  const multCaption: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const blurbStyle: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    maxWidth: 280,
  };

  const sharpeningStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };

  const glyphPos: ViewStyle = {
    position: 'absolute',
    top: t.space[4],
    right: t.space[4],
  };

  return (
    <View style={card}>
      {/* Amber honey-glow — decorative radial backdrop, mirrors ArchetypeHero */}
      <Svg
        width={180}
        height={180}
        style={{ position: 'absolute', top: -t.space[10], right: -t.space[8] }}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="revealGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={t.colors.accent} stopOpacity={t.gradients.backdropTop} />
            <Stop offset="70%" stopColor={t.colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={90} cy={90} r={90} fill="url(#revealGlow)" />
      </Svg>

      {/* Bee glyph — rises and settles as the hero primary element */}
      <Animated.View style={[glyphPos, beeAnimStyle]} pointerEvents="none">
        <BeeGlyph size={t.companion.hudBee} />
      </Animated.View>

      {/* Eyebrow — static, gives spatial anchor before animation fires */}
      <Text style={eyebrowStyle}>YOUR TIME PERSONALITY</Text>

      {/* Title — fades + rises after bee */}
      <Animated.Text style={[titleStyle, titleAnimStyle]}>{title}</Animated.Text>

      {/* Multiplier — scale-pops */}
      <Animated.View style={[multRow, multAnimStyle]}>
        <Text style={multStyle}>{multiplier.toFixed(1)}×</Text>
        <Text style={multCaption}>your guess, on average</Text>
      </Animated.View>

      {/* Blurb + sharpening note — quiet fade-rise together */}
      <Animated.View style={blurbAnimStyle}>
        <Text style={blurbStyle}>{blurb}</Text>
        <Text style={sharpeningStyle}>{'I\'ll sharpen this as you log.'}</Text>
      </Animated.View>

      {/* CTA — last to appear, full-width */}
      <Animated.View style={[{ marginTop: t.space[3] }, btnAnimStyle]}>
        <AppButton label="Continue →" variant="indigo" size="md" fullWidth onPress={onContinue} />
      </Animated.View>
    </View>
  );
}
