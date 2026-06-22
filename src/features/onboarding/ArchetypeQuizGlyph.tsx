import { type ComponentProps, useEffect } from 'react';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
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
// SELECT ANIMATION — refined PATH motion only. On active=true the WHOLE glyph
// REDRAWS itself: every stroke draws in via strokeDashoffset over its OWN length
// (`len`), filled bodies bloom (fillOpacity), and the dots fade in. One `draw`
// value (0→1, ease-out) drives it all. NOT pathLength — react-native-svg ignores
// that and renders dotted; we dash by the real length so the line stays solid and
// genuinely draws. NOT a scale/bounce/nudge of the illustration (reads cheap).
// Reduced-motion / unselected = full still state.
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

const APath = Animated.createAnimatedComponent(Path);
const ALine = Animated.createAnimatedComponent(Line);
const ACircle = Animated.createAnimatedComponent(Circle);
const AG = Animated.createAnimatedComponent(G);

// A stroke that draws itself in: dashed by its OWN length so it sits solid at
// rest (offset 0) and reveals as `draw` goes 0→1. `bloom` also fades the body
// fill in. (Named `bloom`, not `fill`, to avoid colliding with SVG's fill color.)
type DrawCommon = { draw: SharedValue<number>; len: number; bloom?: boolean };

function useDrawProps(draw: SharedValue<number>, len: number, bloom: boolean) {
  return useAnimatedProps(() =>
    bloom
      ? { strokeDashoffset: len * (1 - draw.get()), fillOpacity: draw.get() }
      : { strokeDashoffset: len * (1 - draw.get()) },
  );
}

function DrawPath({ draw, len, bloom = false, ...rest }: ComponentProps<typeof APath> & DrawCommon) {
  const animatedProps = useDrawProps(draw, len, bloom);
  return <APath strokeDasharray={len} animatedProps={animatedProps} {...rest} />;
}
function DrawLine({ draw, len, bloom = false, ...rest }: ComponentProps<typeof ALine> & DrawCommon) {
  const animatedProps = useDrawProps(draw, len, bloom);
  return <ALine strokeDasharray={len} animatedProps={animatedProps} {...rest} />;
}
function DrawCircle({ draw, len, bloom = false, ...rest }: ComponentProps<typeof ACircle> & DrawCommon) {
  const animatedProps = useDrawProps(draw, len, bloom);
  return <ACircle strokeDasharray={len} animatedProps={animatedProps} {...rest} />;
}

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

  // 0 = undrawn, 1 = fully drawn. Rests at 1 (unselected shows complete); the
  // moment it becomes active it snaps to 0 and redraws to 1.
  const draw = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) {
      draw.set(1);
      return;
    }
    draw.set(0);
    // Slow, deliberate pen-stroke draw — ease-in-out reads smooth at both ends.
    draw.set(withTiming(1, { duration: t.motion.draw, easing: Easing.inOut(Easing.cubic) }));
  }, [active, reduced, kind, draw, t.motion.draw]);

  // Pure fill dots/accents fade in as a group.
  const fadeProps = useAnimatedProps(() => ({ opacity: draw.get() }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      {/* ── PACE: pace_about — tidy target with a confirm ✓ ── */}
      {kind === 'pace_about' ? (
        <>
          <DrawCircle draw={draw} len={46} bloom cx={12} cy={12} r={7} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
          {/* Amber ✓ centered in the ring — no bullseye dot (it covered the check). */}
          <DrawPath draw={draw} len={11} d="M8.6 12.2 L11 14.7 L15.6 9.6" fill="none" stroke={amber} strokeWidth={SW + 0.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}

      {/* ── PACE: pace_bit — clock face + short over-arc (slightly past 12) ── */}
      {kind === 'pace_bit' ? (
        <>
          <DrawCircle draw={draw} len={50} bloom cx={12} cy={12} r={7.5} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
          <DrawLine draw={draw} len={7} x1={12} y1={12} x2={12} y2={6.2} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={5} x1={12} y1={12} x2={8.2} y2={12} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={5} d="M12 4.5 A7.5 7.5 0 0 1 15.5 5.6" fill="none" stroke={amber} strokeWidth={SW + 0.2} strokeLinecap="round" />
        </>
      ) : null}

      {/* ── PACE: pace_lot — clock face + long over-arc (past 3 o'clock) ── */}
      {kind === 'pace_lot' ? (
        <>
          <DrawCircle draw={draw} len={50} bloom cx={12} cy={12} r={7.5} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
          <DrawLine draw={draw} len={7} x1={12} y1={12} x2={12} y2={6.2} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={5} x1={12} y1={12} x2={8.2} y2={12} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={14} d="M12 4.5 A7.5 7.5 0 0 1 19.5 12" fill="none" stroke={amber} strokeWidth={SW + 0.2} strokeLinecap="round" />
        </>
      ) : null}

      {/* ── PACE: pace_lose — loose spiral/tangle ── */}
      {kind === 'pace_lose' ? (
        <>
          <DrawPath draw={draw} len={50} d="M12 5 C16.5 5 19 8 19 12 C19 16.4 15.5 19 12 19 C8.5 19 5 16.4 5 12 C5 8.6 7 6.5 10 5.8" fill="none" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={20} d="M12 8.5 C14 8.5 15.5 10 15.5 12 C15.5 14 14 15.5 12 15.5 C10.5 15.5 9.5 14.5 9.5 13" fill="none" stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={6} d="M10 5.8 C9 5.5 7.5 5.8 7 7" fill="none" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
        </>
      ) : null}

      {/* ── MID: mid_track — straight rightward arrow ── */}
      {kind === 'mid_track' ? (
        <>
          <DrawLine draw={draw} len={15} x1={4} y1={12} x2={18} y2={12} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={12} d="M14 8.5 L18 12 L14 15.5" fill="none" stroke={amber} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
          <AG animatedProps={fadeProps}>
            <Circle cx={4} cy={12} r={1.4} fill={indigoSoft} stroke={indigo} strokeWidth={1} />
          </AG>
        </>
      ) : null}

      {/* ── MID: mid_rabbit — branching/forking path ── */}
      {kind === 'mid_rabbit' ? (
        <>
          <DrawPath draw={draw} len={7} d="M4 12 L10 12" fill="none" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={9.5} d="M10 12 L17 7.5" fill="none" stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={9.5} d="M10 12 L17 16.5" fill="none" stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <AG animatedProps={fadeProps}>
            <Circle cx={10} cy={12} r={1.6} fill={indigoSoft} stroke={indigo} strokeWidth={1} />
            <Circle cx={17} cy={7.5} r={1.4} fill={indigo} />
            <Circle cx={17} cy={16.5} r={1.4} fill={amber} />
          </AG>
        </>
      ) : null}

      {/* ── FOCUS: focus_morning — sun with radiating rays ── */}
      {kind === 'focus_morning' ? (
        <>
          <DrawCircle draw={draw} len={27} bloom cx={12} cy={12} r={4} fill={indigoSoft} stroke={indigo} strokeWidth={SW} />
          <DrawLine draw={draw} len={2.4} x1={12} y1={6.5} x2={12} y2={4.8} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={15.3} y1={7.2} x2={16.5} y2={6} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={17.5} y1={12} x2={19.2} y2={12} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={15.3} y1={16.8} x2={16.5} y2={18} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={12} y1={17.5} x2={12} y2={19.2} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={8.7} y1={16.8} x2={7.5} y2={18} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={6.5} y1={12} x2={4.8} y2={12} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={8.7} y1={7.2} x2={7.5} y2={6} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
        </>
      ) : null}

      {/* ── FOCUS: focus_evening — crescent moon ── */}
      {kind === 'focus_evening' ? (
        <>
          <DrawPath draw={draw} len={62} bloom d="M14.5 5.2 A8 8 0 1 0 14.5 18.8 A6 6 0 1 1 14.5 5.2 Z" fill={indigoSoft} stroke={indigo} strokeWidth={SW} strokeLinejoin="round" />
          <AG animatedProps={fadeProps}>
            <Circle cx={17.5} cy={7} r={1.2} fill={amber} />
            <Circle cx={19} cy={10} r={0.7} fill={amber} />
          </AG>
        </>
      ) : null}

      {/* ── FOCUS: focus_varies — half-sun on horizon line ── */}
      {kind === 'focus_varies' ? (
        <>
          <DrawLine draw={draw} len={18} x1={3.5} y1={14} x2={20.5} y2={14} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawPath draw={draw} len={20} bloom d="M6.5 14 A5.5 5.5 0 0 1 17.5 14" fill={indigoSoft} stroke={indigo} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={12} y1={7} x2={12} y2={5.5} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={15.8} y1={8.2} x2={16.9} y2={7} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <DrawLine draw={draw} len={2.4} x1={8.2} y1={8.2} x2={7.1} y2={7} stroke={amber} strokeWidth={SW} strokeLinecap="round" />
          <AG animatedProps={fadeProps}>
            <Ellipse cx={3.5} cy={14} rx={1.2} ry={1.2} fill={amber} />
            <Ellipse cx={20.5} cy={14} rx={1.2} ry={1.2} fill={amber} />
          </AG>
        </>
      ) : null}
    </Svg>
  );
}
