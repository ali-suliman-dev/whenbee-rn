import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestBand — the Pro honest-range track (Views, not SVG).
//
// A single hairline well with a filled segment marking [low, high] and a tick at
// the point number. The reveal animates the segment from the full track width
// INWARD to its [low, high] width — the "narrowing" gesture in miniature, so even
// first-time users feel the band tightening to their data. The band only ever
// animates inward / to a resolved width; it is never colored as a regression.
// ──────────────────────────────────────────────────────────────────────────────

interface HonestBandProps {
  range: HonestRange;
  /** The honest point number — the single best guess inside the spread. */
  point: number;
  confidence: CalibrationConfidence;
  /** Track height in points. Surface A uses progress.track (6); B uses gapTrack (8). */
  height: number;
  /** Low confidence reads calmer (a wider, softer fill); honest reads as the payoff. */
  fillTone?: 'soft' | 'accent';
}

function floor5(n: number): number {
  return Math.floor(n / 5) * 5;
}
function ceil5(n: number): number {
  return Math.ceil(n / 5) * 5;
}

/** The fixed visual domain so the segment width is comparable across renders.
 *  Presentation only — the engine returns minutes; this maps minutes → fractions. */
function bandFractions(range: HonestRange, point: number): {
  left: number;
  width: number;
  point: number;
} {
  const domainLow = Math.max(0, floor5(range.lowMinutes * 0.6));
  const domainHigh = ceil5(range.highMinutes * 1.4);
  const span = Math.max(domainHigh - domainLow, 5); // never divide by zero
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const at = (m: number) => clamp01((m - domainLow) / span);
  const left = at(range.lowMinutes);
  return {
    left,
    width: Math.max(at(range.highMinutes) - left, 0.04), // always a visible sliver
    point: at(point),
  };
}

export function HonestBand({ range, point, confidence, height, fillTone }: HonestBandProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const frac = bandFractions(range, point);

  const tone = fillTone ?? (confidence === 'honest' ? 'accent' : 'soft');
  const fillColor = tone === 'accent' ? t.colors.accent : t.colors.accentSoft;

  // The segment width animates from the full track inward to its target fraction.
  const widthFrac = useSharedValue(reduceMotion ? frac.width : 1);
  const leftFrac = useSharedValue(frac.left);
  const tickOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    const timing = { duration: t.motion.base, easing: t.motion.easing.out, reduceMotion: ReduceMotion.System };
    widthFrac.set(withTiming(frac.width, timing));
    leftFrac.set(withTiming(frac.left, timing));
    // The tick lands after the segment settles, so the eye reads spread → point.
    tickOpacity.set(
      withDelay(t.motion.fast, withTiming(1, { duration: t.motion.fast, reduceMotion: ReduceMotion.System })),
    );
  }, [frac.width, frac.left, t.motion, widthFrac, leftFrac, tickOpacity]);

  const segmentStyle = useAnimatedStyle(() => ({
    left: `${leftFrac.get() * 100}%`,
    width: `${widthFrac.get() * 100}%`,
  }));
  const tickStyle = useAnimatedStyle(() => ({
    left: `${frac.point * 100}%`,
    opacity: tickOpacity.get(),
  }));

  const track: ViewStyle = {
    height,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
    justifyContent: 'center',
  };
  const segment: ViewStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: fillColor,
    borderRadius: t.radii.full,
  };
  // The tick is centered on its left%; pull it back by half its width so it sits
  // on the point, not beside it. It rides ABOVE the well (not clipped) so it reads.
  const tickWrap: ViewStyle = {
    position: 'absolute',
    top: -t.space[0.5],
    bottom: -t.space[0.5],
    width: t.progress.tickW,
    marginLeft: -t.progress.tickW / 2,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const tick: ViewStyle = {
    width: t.progress.tickW,
    height: '100%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentEdge,
  };

  return (
    <View style={track}>
      <Animated.View style={[segment, segmentStyle]} />
      <Animated.View style={[tickWrap, tickStyle]} pointerEvents="none">
        <View style={tick} />
      </Animated.View>
    </View>
  );
}
