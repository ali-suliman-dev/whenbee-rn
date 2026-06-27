import { View, Text, Platform, type ViewStyle, type TextStyle, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useEffect, useState } from 'react';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { buildRevealEcho } from '@/src/engine';
import { ArchetypeCrest } from './ArchetypeCrest';
import type { QuizAnswers } from '@/src/engine';

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

// Looping shine timing: a slow visible glance, then an off-screen rest, on repeat.
const SWEEP_DUR = 1150; // visible diagonal pass (calm, a touch quicker)
const SWEEP_GAP = 4800; // invisible rest between passes (~4.8s wait)
const SWEEP_CYCLE = SWEEP_DUR + SWEEP_GAP;
const SWEEP_VIS = SWEEP_DUR / SWEEP_CYCLE; // fraction of the cycle the glance is visible

interface ArchetypeRevealProps {
  title: string;
  blurb: string;
  multiplier: number;
  quizAnswers: QuizAnswers;
  onContinue: () => void;
}

export function ArchetypeReveal({
  title,
  blurb,
  multiplier,
  quizAnswers,
  onContinue,
}: ArchetypeRevealProps): React.JSX.Element {
  const t = useTheme();
  const reduced = useReducedMotion();

  // The gradient is drawn by an SVG overlay. react-native-svg percentage sizing
  // ("100%") can under-resolve against an <Svg> that has no explicit dimensions,
  // leaving a strip of the card's flat backgroundColor showing → a hard vertical
  // seam. Measuring the card and sizing the SVG + rects in EXPLICIT pixels makes
  // full coverage deterministic.
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const onCardLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  // Entering-only. The card fades; the crest ILLUSTRATION scales in (a resize, not a
  // slide/bounce) while the bee animates its own paths; text fades. No translateY,
  // no spring, button never animates.
  const cardOpacity = useSharedValue(reduced ? 1 : 0);
  const crestOpacity = useSharedValue(reduced ? 1 : 0);
  const crestScale = useSharedValue(reduced ? 1 : 0.86);
  const echoV = useSharedValue(reduced ? 1 : 0);
  const eyebrow = useSharedValue(reduced ? 1 : 0);
  const titleV = useSharedValue(reduced ? 1 : 0);
  const stat = useSharedValue(reduced ? 1 : 0);
  const blurbV = useSharedValue(reduced ? 1 : 0);
  const noteV = useSharedValue(reduced ? 1 : 0);
  // One-pass diagonal light sweep glancing across the card on reveal (0→1 progress).
  const sweep = useSharedValue(reduced ? 1 : 0);
  // The echo line is derived once; pure so it can't throw.
  const echoLine = `From your answers: ${buildRevealEcho(quizAnswers)}`;

  useEffect(() => {
    if (reduced) return;
    const out = { duration: t.motion.reveal, easing: t.motion.easing.out };
    cardOpacity.set(withTiming(1, out));
    crestOpacity.set(withTiming(1, out));
    crestScale.set(withTiming(1, out));
    const fade = (sv: typeof eyebrow, delay: number) =>
      sv.set(withDelay(delay, withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard })));
    fade(eyebrow, 220);
    fade(echoV, 260);
    fade(titleV, 320);
    fade(stat, 420);
    fade(blurbV, 540);
    fade(noteV, 660);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Looping light sweep, started once the card is measured (it needs the width to
  // travel across). A single linear driver repeats over the FULL cycle; the visible
  // glance lives in the first SWEEP_VIS fraction and the rest is an off-screen,
  // invisible rest (the ~1.7s gap), so the loop never reverse-travels or pops. Calm
  // and slow. Reduce-motion → no sweep (the static sheen stays).
  useEffect(() => {
    if (reduced || size.w === 0) return;
    sweep.set(withDelay(300, withRepeat(withTiming(1, { duration: SWEEP_CYCLE, easing: Easing.linear }), -1, false)));
  }, [size.w]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.get() }));
  const crestStyle = useAnimatedStyle(() => ({
    opacity: crestOpacity.get(),
    transform: [{ scale: crestScale.get() }],
  }));
  const echoAnim = useAnimatedStyle(() => ({ opacity: echoV.get() }));
  const eyebrowAnim = useAnimatedStyle(() => ({ opacity: eyebrow.get() }));
  const titleAnim = useAnimatedStyle(() => ({ opacity: titleV.get() }));
  // Subtle resize on the headline stat — a gentle settle, never a bounce.
  const statAnim = useAnimatedStyle(() => ({ opacity: stat.get(), transform: [{ scale: 0.96 + stat.get() * 0.04 }] }));
  // The light sweep: a tilted bright strip travelling left→right once, fading in at
  // the start and out at the end so it never pops. Decorative shine, not content.
  const sweepStyle = useAnimatedStyle(() => {
    const w = size.w || 1;
    const local = sweep.get() / SWEEP_VIS; // 0→1 across the glance, >1 during the rest
    if (local >= 1) return { opacity: 0, transform: [{ translateX: -w }, { rotate: '18deg' }] };
    const tx = -w * 0.7 + local * (w * 2.1);
    const op = Math.min(local / 0.2, (1 - local) / 0.2, 1);
    return { opacity: op * 0.8, transform: [{ translateX: tx }, { rotate: '18deg' }] };
  });
  const blurbAnim = useAnimatedStyle(() => ({ opacity: blurbV.get() }));
  const noteAnim = useAnimatedStyle(() => ({ opacity: noteV.get() }));

  const card: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: t.reveal.gradBot,
    // No border — elevation comes from the soft drop shadow below (a hairline edge
    // read as a hard line on this dark card).
    paddingHorizontal: t.space[6],
    paddingTop: t.space[8],
    paddingBottom: t.space[6],
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: t.shadow.lift.radius, shadowOffset: { width: 0, height: t.shadow.lift.offset } },
      default: { elevation: t.shadow.lift.elevation },
    }),
  };
  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.reveal.eyebrowOn, textAlign: 'center', marginTop: t.space[4] };
  // Echo line: answer-echo above the title. bodySm / reveal.blurbOn, centered.
  const echoStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.reveal.blurbOn, textAlign: 'center', marginTop: t.space[3] };
  const titleStyle: TextStyle = { ...(type.title as unknown as TextStyle), color: t.reveal.inkOn, textAlign: 'center', marginTop: t.space[2] };
  // Stat: the multiplier is the hero, centred on the card so it sits on the same
  // optical axis as the title (a caption beside it would shove it off-centre). The
  // `×` is a smaller muted unit suffix, not a same-size digit. The descriptor reads
  // as one quiet centred line beneath.
  const statBlock: ViewStyle = { alignItems: 'center', marginTop: t.space[4] };
  const multRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline' };
  const multStyle: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.brand.honeyFill };
  const multX: TextStyle = { ...(type.honestNumberMd as unknown as TextStyle), color: t.brand.honeyFill, opacity: 0.85, marginLeft: t.space[0.5] };
  const multCaption: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.reveal.blurbOn, textAlign: 'center', marginTop: t.space[1.5] };
  const blurbStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.reveal.blurbOn, textAlign: 'center', marginTop: t.space[5], maxWidth: t.size.shareCard * 0.82 };
  // Quiet note beneath the card (on the screen, not the card): tells the user the
  // personality is provisional and re-learns from real logs. Muted secondary ink.
  const noteStyle: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, textAlign: 'center', alignSelf: 'center', marginTop: t.space[5], maxWidth: t.size.shareCard };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[card, cardStyle]} onLayout={onCardLayout}>
        {/* Card surface: a smooth top→bottom deep-indigo gradient with a soft indigo
            light pooled behind the crest. The SVG + rects are sized in EXPLICIT
            measured pixels (not "100%"), so the fill covers the whole card with no
            uncovered strip → no hard seam. */}
        {size.w > 0 ? (
          <Svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="revealGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.reveal.gradTop} />
                <Stop offset="0.55" stopColor={t.reveal.gradMid} />
                <Stop offset="1" stopColor={t.reveal.gradBot} />
              </LinearGradient>
              <RadialGradient
                id="revealBloom"
                cx={size.w / 2}
                cy={size.h * 0.2}
                r={size.w * 0.75}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={t.reveal.bloom} stopOpacity={0.22} />
                <Stop offset="0.5" stopColor={t.reveal.bloom} stopOpacity={0.06} />
                <Stop offset="1" stopColor={t.reveal.bloom} stopOpacity={0} />
              </RadialGradient>
              {/* Diagonal reflection: a soft light streak glancing top-left → centre,
                  peaking off-axis so it reads as a glare on the surface, not a band. */}
              <LinearGradient
                id="revealSheen"
                x1="0"
                y1="0"
                x2={size.w}
                y2={size.h}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={t.reveal.sheen} stopOpacity={0} />
                <Stop offset="0.42" stopColor={t.reveal.sheen} stopOpacity={0.1} />
                <Stop offset="0.62" stopColor={t.reveal.sheen} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#revealGrad)" />
            <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#revealBloom)" />
            <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#revealSheen)" />
          </Svg>
        ) : null}

        {/* One-pass diagonal light sweep on reveal (epic but calm). Decorative; sits
            over the surface, under the content, and never loops. */}
        {size.w > 0 && !reduced ? (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: -size.h * 0.25, left: 0, width: size.w * 0.3, height: size.h * 1.5 },
              sweepStyle,
            ]}
          >
            <Svg
              width={size.w * 0.3}
              height={size.h * 1.5}
              viewBox={`0 0 ${size.w * 0.3} ${size.h * 1.5}`}
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient id="revealSweep" x1="0" y1="0" x2={size.w * 0.3} y2="0" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={t.reveal.sheen} stopOpacity={0} />
                  <Stop offset="0.5" stopColor={t.reveal.sheen} stopOpacity={0.13} />
                  <Stop offset="1" stopColor={t.reveal.sheen} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={size.w * 0.3} height={size.h * 1.5} fill="url(#revealSweep)" />
            </Svg>
          </Animated.View>
        ) : null}

        <Animated.View style={crestStyle}>
          <ArchetypeCrest />
        </Animated.View>
        <Animated.Text style={[eyebrowStyle, eyebrowAnim]}>YOUR TIME PERSONALITY</Animated.Text>
        <Animated.Text style={[echoStyle, echoAnim]}>{echoLine}</Animated.Text>
        <Animated.Text style={[titleStyle, titleAnim]}>{title}</Animated.Text>
        <Animated.View style={[statBlock, statAnim]}>
          <View style={multRow}>
            <Text style={multStyle}>{multiplier.toFixed(1)}</Text>
            <Text style={multX}>×</Text>
          </View>
          <Text style={multCaption}>your guess, on average</Text>
        </Animated.View>
        <Animated.Text style={[blurbStyle, blurbAnim]}>{blurb}</Animated.Text>
      </Animated.View>

      <Animated.Text style={[noteStyle, noteAnim]}>
        A first read from your answers. Every task you time makes it sharper — and your type can move as your numbers do.
      </Animated.Text>

      <View style={{ flex: 1 }} />

      <AppButton label="Sharpen it on my tasks →" variant="indigo" fullWidth onPress={onContinue} />
    </View>
  );
}
