import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// GapLine — the guess→plan calibration line on Today's focus card.
//   • indigo segment = the user's guess (the optimistic anchor)
//   • amber  segment = the +minutes it really takes (the learned gap)
// Full length = the plan (honest) total. The amber reveals on mount (the gap
// "appearing"), never a scold — amber states a fact. When a session is running,
// an ink marker rides the bar at the live elapsed fraction, gliding each tick.
// Only `transform`/`opacity` animate (UI thread); the marker's % position is the
// one layout value, updated ~1×/s.
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

  // Amber gap grows in from the left (origin-anchored scaleX) — entrance ease-out.
  const reveal = useSharedValue(reduced || extraFrac === 0 ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      reveal.set(1);
      return;
    }
    reveal.set(
      withDelay(t.motion.fast, withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard })),
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
  const guessSeg: ViewStyle = { width: `${guessFrac * 100}%`, backgroundColor: t.colors.primary };
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
        <View style={guessSeg} />
        <Animated.View style={[extraSeg, extraStyle]} />
      </View>
      {elapsedFrac != null ? <Animated.View style={[marker, markerStyle]} /> : null}
    </View>
  );
}
