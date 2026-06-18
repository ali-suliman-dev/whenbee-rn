import { useTheme } from '@/src/theme/useTheme';
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

// ──────────────────────────────────────────────────────────────────────────────
// GapLine — the guess→plan calibration line on Today's focus card.
//   • indigo segment = the user's guess (hatched, so it yields visual weight to
//     the solid indigo Start button — one filled indigo per screen rule).
//     Dark mode: diagonal two-tone indigo stripes (primary + primaryEdge).
//     Light mode: solid primarySoft fill.
//   • amber  segment = the +minutes it really takes (the learned gap)
// Full length = the plan (honest) total. The amber reveals on mount (the gap
// "appearing"), never a scold — amber states a fact. When a session is running,
// an ink marker rides the bar at the live elapsed fraction, gliding each tick.
// Only `transform`/`opacity` animate (UI thread); the marker's % position is the
// one layout value, updated ~1×/s.
// Entrance sequence: striped guess fills first (scaleX from left), then after it
// completes the amber gap fills — reads as "this is what you guessed, here's
// the extra" rather than two simultaneous reveals.
// ──────────────────────────────────────────────────────────────────────────────

interface GapLineProps {
  guessMin: number;
  honestMin: number;
  /** When provided, draws the live elapsed marker (running session). */
  elapsedSec?: number;
}

function clampFrac(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function GapLine({ guessMin, honestMin, elapsedSec }: GapLineProps) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const total = Math.max(honestMin, guessMin, 1);
  const guessFrac = clampFrac(guessMin / total);
  const extraFrac = 1 - guessFrac;
  const elapsedFrac = elapsedSec == null ? null : clampFrac(elapsedSec / (total * 60));

  // Striped guess fills FIRST (scaleX from the left), then the amber gap fills.
  const guessReveal = useSharedValue(reduced || guessFrac === 0 ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      guessReveal.set(1);
      return;
    }
    guessReveal.set(withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard }));
  }, [reduced, guessReveal, t.motion]);
  const guessStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: guessReveal.get() }] }));

  // Amber gap grows in from the left (origin-anchored scaleX) — entrance ease-out.
  // Delayed by base + fast so it begins after the striped guess finishes filling.
  const reveal = useSharedValue(reduced || extraFrac === 0 ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      reveal.set(1);
      return;
    }
    reveal.set(
      withDelay(
        t.motion.base + t.motion.fast,
        withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard }),
      ),
    );
  }, [reduced, reveal, t.motion]);
  const extraStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: reveal.get() }] }));

  // Elapsed marker glides between the once-a-second ticks (linear, no easing).
  const markerLeft = useSharedValue(elapsedFrac ?? 0);
  useEffect(() => {
    if (elapsedFrac == null) return;
    if (reduced) {
      markerLeft.set(elapsedFrac);
      return;
    }
    markerLeft.set(withTiming(elapsedFrac, { duration: t.motion.slow, easing: Easing.linear }));
  }, [elapsedFrac, reduced, markerLeft, t.motion]);
  const markerStyle = useAnimatedStyle(() => ({ left: `${markerLeft.get() * 100}%` }));

  const track: ViewStyle = {
    flexDirection: 'row',
    height: t.progress.gapTrack,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const guessSeg: ViewStyle = {
    width: `${guessFrac * 100}%`,
    backgroundColor: t.colors.primarySoft2,
    overflow: 'hidden',
    transformOrigin: 'left',
  };
  const extraSeg: ViewStyle = {
    width: `${extraFrac * 100}%`,
    backgroundColor: t.colors.accent,
    transformOrigin: 'left',
  };
  const marker: ViewStyle = {
    position: 'absolute',
    top: -(t.progress.tickH - t.progress.gapTrack) / 2,
    marginLeft: -t.progress.tickW / 2,
    width: t.progress.tickW,
    height: t.progress.tickH,
    borderRadius: t.progress.tickW,
    backgroundColor: t.colors.ink,
  };

  return (
    <View>
      <View style={track}>
        <Animated.View style={[guessSeg, guessStyle]} testID="gapline-guess">
          <Svg width="100%" height={t.progress.gapTrack}>
            <Defs>
              <Pattern id="gapDiag" patternUnits="userSpaceOnUse" width="16" height="16">
                <Rect x="0" y="0" width="16" height="16" fill={t.colors.primarySoft2} />
                {/* Lines extend to y=-8…24 so end caps stay outside the 8px bar */}
                <Line x1="-16" y1="24" x2="16" y2="-8" stroke={t.colors.primary} strokeWidth="4" />
                <Line x1="0" y1="24" x2="32" y2="-8" stroke={t.colors.primary} strokeWidth="4" />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#gapDiag)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[extraSeg, extraStyle]} testID="gapline-extra" />
      </View>
      {elapsedFrac != null ? <Animated.View style={[marker, markerStyle]} /> : null}
    </View>
  );
}
//primarySoft
//gapStripeHi
