import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeQuizGlyph — illustrated two-tone SVG answer glyphs for the
// time-style quiz chips. One coherent set drawn on a 24-box with 1.6px strokes
// and rounded joins, in the brand indigo (body) + amber (accent) palette.
//
// Nine kinds mapped to the three quiz question families:
//   PACE   pace_about · pace_bit · pace_lot · pace_lose
//   MID    mid_track · mid_rabbit
//   FOCUS  focus_morning · focus_evening · focus_varies
//
// Each plays a ONE-SHOT, meaning-mapped select animation when active=true.
// Reduced-motion lands on the still final state, no motion.
// ──────────────────────────────────────────────────────────────────────────────

export type QuizGlyphKind =
  | 'pace_about'
  | 'pace_bit'
  | 'pace_lot'
  | 'pace_lose'
  | 'mid_track'
  | 'mid_rabbit'
  | 'focus_morning'
  | 'focus_evening'
  | 'focus_varies';

const BOX = 24;
const SW = 1.6; // stroke width — matches ReasonGlyph exactly

export function ArchetypeQuizGlyph({
  kind,
  active,
  size = 22,
}: {
  kind: QuizGlyphKind;
  active: boolean;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const indigo = t.colors.primary;
  const indigoSoft = t.colors.primarySoft;
  const amber = t.colors.accent;

  // One shared transform per axis; only the axes a given kind needs get driven.
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      rot.set(0);
      scale.set(1);
      tx.set(0);
      return;
    }
    const spring = t.motion.spring;
    const pop = t.motion.press; // 110ms — button-press feedback duration

    switch (kind) {
      // pace_about: a tidy target/✓ — confirm pop (scale up then spring back).
      // Emotional intent: satisfaction / accuracy. Short, snappy.
      case 'pace_about':
        scale.set(withSequence(withTiming(1.18, { duration: pop }), withSpring(1, spring)));
        break;

      // pace_bit: clock with short over-arc — the arc ticks out (small forward nudge).
      // Emotional intent: slight positive drift, contained.
      case 'pace_bit':
        tx.set(withSequence(withTiming(2.5, { duration: pop }), withSpring(0, spring)));
        break;

      // pace_lot: clock with long over-arc — sweeps further (larger forward nudge).
      // Emotional intent: more pronounced drift, still playful not alarming.
      case 'pace_lot':
        tx.set(withSequence(withTiming(5, { duration: pop }), withSpring(0, spring)));
        break;

      // pace_lose: loose spiral/tangle — gentle unspool (small wobble rotation).
      // Emotional intent: loose / scattered, soft not shameful.
      case 'pace_lose':
        rot.set(
          withSequence(
            withTiming(-10, { duration: 90 }),
            withTiming(8, { duration: 110 }),
            withTiming(-4, { duration: 80 }),
            withSpring(0, spring),
          ),
        );
        break;

      // mid_track: straight arrow — nudges forward (rightward translate).
      // Emotional intent: direction, decisiveness, momentum.
      case 'mid_track':
        tx.set(withSequence(withTiming(4, { duration: pop }), withSpring(0, spring)));
        break;

      // mid_rabbit: branching/forking path — the branch springs (scale pop).
      // Emotional intent: quick divergence, lively energy.
      case 'mid_rabbit':
        scale.set(withSequence(withTiming(1.22, { duration: pop }), withSpring(1, spring)));
        break;

      // focus_morning: sun with rays — rays expand (scale out).
      // Emotional intent: warmth, expansion, rising energy.
      case 'focus_morning':
        scale.set(withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, spring)));
        break;

      // focus_evening: moon — soft tilt (gentle rotation).
      // Emotional intent: calm, settling, ease into quiet.
      case 'focus_evening':
        rot.set(
          withSequence(withTiming(-12, { duration: 120 }), withSpring(0, spring)),
        );
        break;

      // focus_varies: half-sun/horizon — small rock (gentle back-and-forth).
      // Emotional intent: variability, openness, no fixed pattern.
      case 'focus_varies':
        rot.set(
          withSequence(
            withTiming(-6, { duration: 90 }),
            withTiming(6, { duration: 110 }),
            withSpring(0, spring),
          ),
        );
        break;
    }
  }, [active, reduced, kind, rot, scale, tx, t.motion.press, t.motion.spring]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { rotate: `${rot.get()}deg` }, { scale: scale.get() }],
  }));

  return (
    <Animated.View style={anim}>
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
        {/* ── PACE: pace_about — tidy target with a confirm ✓ ── */}
        {kind === 'pace_about' ? (
          <>
            {/* Outer ring */}
            <Circle
              cx={12}
              cy={12}
              r={7}
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
            />
            {/* Inner bullseye dot */}
            <Circle cx={12} cy={12} r={2} fill={indigo} />
            {/* Amber checkmark accent — sits over the target */}
            <Path
              d="M8.8 12.4 L11 14.6 L15.4 9.8"
              fill="none"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {/* ── PACE: pace_bit — clock face + short over-arc (slightly past 12) ── */}
        {kind === 'pace_bit' ? (
          <>
            {/* Clock body */}
            <Circle
              cx={12}
              cy={12}
              r={7.5}
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
            />
            {/* Clock hands: minute hand pointing up (12), hour at 9 */}
            <Line
              x1={12}
              y1={12}
              x2={12}
              y2={6.2}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            <Line
              x1={12}
              y1={12}
              x2={8.2}
              y2={12}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Short over-arc: a small amber arc just past 12 o'clock (clockwise) */}
            <Path
              d="M12 4.5 A7.5 7.5 0 0 1 15.5 5.6"
              fill="none"
              stroke={amber}
              strokeWidth={SW + 0.2}
              strokeLinecap="round"
            />
          </>
        ) : null}

        {/* ── PACE: pace_lot — clock face + long over-arc (past 3 o'clock) ── */}
        {kind === 'pace_lot' ? (
          <>
            {/* Clock body */}
            <Circle
              cx={12}
              cy={12}
              r={7.5}
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
            />
            {/* Clock hands */}
            <Line
              x1={12}
              y1={12}
              x2={12}
              y2={6.2}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            <Line
              x1={12}
              y1={12}
              x2={8.2}
              y2={12}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Long over-arc: sweeps from 12 clockwise past 3 (~105°) */}
            <Path
              d="M12 4.5 A7.5 7.5 0 0 1 19.5 12"
              fill="none"
              stroke={amber}
              strokeWidth={SW + 0.2}
              strokeLinecap="round"
            />
          </>
        ) : null}

        {/* ── PACE: pace_lose — loose spiral/tangle ── */}
        {kind === 'pace_lose' ? (
          <>
            {/* Outer loop — the tangled-ball body */}
            <Path
              d="M12 5 C16.5 5 19 8 19 12 C19 16.4 15.5 19 12 19 C8.5 19 5 16.4 5 12 C5 8.6 7 6.5 10 5.8"
              fill="none"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Inner spiral coil — amber accent, tighter inner loop */}
            <Path
              d="M12 8.5 C14 8.5 15.5 10 15.5 12 C15.5 14 14 15.5 12 15.5 C10.5 15.5 9.5 14.5 9.5 13"
              fill="none"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Loose tail — gives the unravelling sense */}
            <Path
              d="M10 5.8 C9 5.5 7.5 5.8 7 7"
              fill="none"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
          </>
        ) : null}

        {/* ── MID: mid_track — straight rightward arrow ── */}
        {kind === 'mid_track' ? (
          <>
            {/* Shaft line */}
            <Line
              x1={4}
              y1={12}
              x2={18}
              y2={12}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Arrowhead */}
            <Path
              d="M14 8.5 L18 12 L14 15.5"
              fill="none"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Small dot at origin — the "start" anchor */}
            <Circle cx={4} cy={12} r={1.4} fill={indigoSoft} stroke={indigo} strokeWidth={1} />
          </>
        ) : null}

        {/* ── MID: mid_rabbit — branching/forking path ── */}
        {kind === 'mid_rabbit' ? (
          <>
            {/* Main trunk from left */}
            <Path
              d="M4 12 L10 12"
              fill="none"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Upper branch */}
            <Path
              d="M10 12 L17 7.5"
              fill="none"
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Lower branch — amber accent */}
            <Path
              d="M10 12 L17 16.5"
              fill="none"
              stroke={amber}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Fork dot */}
            <Circle cx={10} cy={12} r={1.6} fill={indigoSoft} stroke={indigo} strokeWidth={1} />
            {/* Branch endpoints */}
            <Circle cx={17} cy={7.5} r={1.4} fill={indigo} />
            <Circle cx={17} cy={16.5} r={1.4} fill={amber} />
          </>
        ) : null}

        {/* ── FOCUS: focus_morning — sun with radiating rays ── */}
        {kind === 'focus_morning' ? (
          <>
            {/* Sun body */}
            <Circle
              cx={12}
              cy={12}
              r={4}
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
            />
            {/* 8 short rays — alternating indigo/amber for warmth */}
            {/* top */}
            <Line x1={12} y1={6.5} x2={12} y2={4.8} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            {/* top-right */}
            <Line x1={15.3} y1={7.2} x2={16.5} y2={6} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            {/* right */}
            <Line x1={17.5} y1={12} x2={19.2} y2={12} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            {/* bottom-right */}
            <Line x1={15.3} y1={16.8} x2={16.5} y2={18} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            {/* bottom */}
            <Line x1={12} y1={17.5} x2={12} y2={19.2} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            {/* bottom-left */}
            <Line x1={8.7} y1={16.8} x2={7.5} y2={18} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
            {/* left */}
            <Line x1={6.5} y1={12} x2={4.8} y2={12} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            {/* top-left */}
            <Line x1={8.7} y1={7.2} x2={7.5} y2={6} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          </>
        ) : null}

        {/* ── FOCUS: focus_evening — crescent moon ── */}
        {kind === 'focus_evening' ? (
          <>
            {/* Crescent body: a full disc clipped by an offset disc.
                Drawn as an arc path: outer circle arc + inner circle arc back. */}
            <Path
              d="M14.5 5.2 A8 8 0 1 0 14.5 18.8 A6 6 0 1 1 14.5 5.2 Z"
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinejoin="round"
            />
            {/* Small amber star accent top-right */}
            <Circle cx={17.5} cy={7} r={1.2} fill={amber} />
            {/* Tiny star-dot */}
            <Circle cx={19} cy={10} r={0.7} fill={amber} />
          </>
        ) : null}

        {/* ── FOCUS: focus_varies — half-sun on horizon line ── */}
        {kind === 'focus_varies' ? (
          <>
            {/* Horizon line */}
            <Line
              x1={3.5}
              y1={14}
              x2={20.5}
              y2={14}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Half-sun semicircle above the horizon */}
            <Path
              d="M6.5 14 A5.5 5.5 0 0 1 17.5 14"
              fill={indigoSoft}
              stroke={indigo}
              strokeWidth={SW}
              strokeLinecap="round"
            />
            {/* Short rays above the half-sun — amber accent */}
            <Line x1={12} y1={7} x2={12} y2={5.5} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            <Line x1={15.8} y1={8.2} x2={16.9} y2={7} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            <Line x1={8.2} y1={8.2} x2={7.1} y2={7} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
            {/* Amber horizon dot at left and right — gives a "land meets sky" read */}
            <Ellipse cx={3.5} cy={14} rx={1.2} ry={1.2} fill={amber} />
            <Ellipse cx={20.5} cy={14} rx={1.2} ry={1.2} fill={amber} />
          </>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
