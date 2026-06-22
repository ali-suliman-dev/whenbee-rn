import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path, Rect, ClipPath, Defs, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ──────────────────────────────────────────────────────────────────────────────
// QuizProgressComb — the onboarding quiz's per-step progress, themed as a honey
// comb instead of a plain bar. One flat-top regular hexagon cell per quiz
// question, packed in a centered row:
//
//   index <  current  → answered    → fully honey-filled (accent)
//   index === current → active       → honey wells up from the bottom on mount
//   index >  current  → unanswered   → sunken empty cell (surfaceSunken)
//
// The active cell reuses the calm honey-settle from `Honeycomb` (a bottom-anchored
// rect clipped to the hex, its top edge animated up with an ease-out — no bounce).
// MONOTONIC by design: progress only advances, so a cell never drains. Entering
// only (no `exiting` — Fabric SIGABRT), and reduced motion lands the final state
// instantly. Pure presentational: it reads `total` + `current` and nothing else.
// ──────────────────────────────────────────────────────────────────────────────

/** Regular flat-top hexagon: height = width × √3/2. */
const HEX_RATIO = Math.sqrt(3) / 2;

interface QuizProgressCombProps {
  /** Number of quiz questions (one comb cell each). */
  total: number;
  /** Zero-based index of the active question. */
  current: number;
}

/** Flat-top regular hexagon path inside a `w`×`h` box (h = w × √3/2). */
function hexPath(w: number, h: number): string {
  const qx = w / 4;
  return [
    `M${qx},0`,
    `L${w - qx},0`,
    `L${w},${h / 2}`,
    `L${w - qx},${h}`,
    `L${qx},${h}`,
    `L0,${h / 2}`,
    'Z',
  ].join(' ');
}

type CellState = 'answered' | 'active' | 'empty';

interface CellProps {
  index: number;
  state: CellState;
  w: number;
  h: number;
}

function QuizCombCell({ index, state, w, h }: CellProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const path = hexPath(w, h);
  const clipId = `quiz-comb-${index}`;

  // Bottom-anchored fill: animate the rect's TOP edge (`y`) from empty (h) up to
  // the baseline (0). Only the active cell wells up; answered cells start full,
  // empty cells stay drained — so nothing moves except the question in play.
  const filledY = state === 'answered' ? 0 : h;
  const startY = state === 'active' && !reducedMotion ? h : filledY;
  const topY = useSharedValue(startY);

  useEffect(() => {
    if (state !== 'active') {
      topY.set(filledY);
      return;
    }
    if (reducedMotion) {
      topY.set(0);
      return;
    }
    // Calm honey settle — ease-out, no overshoot (monotonic, never bounces back).
    topY.set(withTiming(0, { duration: t.motion.honeyFill, easing: Easing.out(Easing.cubic) }));
  }, [state, filledY, reducedMotion, topY, t.motion.honeyFill]);

  const fillProps = useAnimatedProps(() => ({
    y: topY.get(),
    height: h - topY.get(),
  }));

  // Answered cells read as full, saturated honey; the active cell is a softer amber
  // (still clearly "in progress", not yet sealed). Empty cells show no fill at all —
  // just the sunken hex wall below.
  const fillColor = state === 'active' ? t.colors.accentCoin : t.colors.accent;

  return (
    <G>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={path} />
        </ClipPath>
      </Defs>

      {/* Sunken hex floor — the unfilled cell wall (no blur / shadow). */}
      <Path d={path} fill={t.colors.surfaceSunken} />

      {/* Honey fill — clipped to the hex, rising from the bottom. */}
      {state !== 'empty' ? (
        <AnimatedRect
          x={0}
          width={w}
          fill={fillColor}
          clipPath={`url(#${clipId})`}
          animatedProps={fillProps}
        />
      ) : null}
    </G>
  );
}

export function QuizProgressComb({ total, current }: QuizProgressCombProps) {
  const t = useTheme();

  if (total <= 0) return null;

  const w = t.quizComb.cell;
  const h = w * HEX_RATIO;
  const gap = t.quizComb.gap;

  const row: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'center',
    gap,
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Question ${current + 1} of ${total}`}
      style={row}
    >
      {Array.from({ length: total }).map((_, i) => {
        const state: CellState = i < current ? 'answered' : i === current ? 'active' : 'empty';
        return (
          <Svg key={i} width={w} height={h}>
            <QuizCombCell index={i} state={state} w={w} h={h} />
          </Svg>
        );
      })}
    </View>
  );
}
