import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// FillBar — a single animated fill track (Views, not SVG).
//
// A hairline well whose filled segment animates from 0 → `fraction` over the
// standard settle. The caller picks `fillColor` (primarySoft when work fits,
// accent when the window is full) so the bar reads calm or "full" without ever
// implying a score is dropping — it only ever fills forward to a resolved width.
// Entering-only; reduced motion paints the final width immediately.
// ──────────────────────────────────────────────────────────────────────────────

interface FillBarProps {
  /** 0..1 share of the track that is filled. Clamped defensively. */
  fraction: number;
  /** The fill color — caller chooses (e.g. primarySoft for fits, accent for full). */
  fillColor: string;
  /** Track height in points. Defaults to progress.track (6). */
  height?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function FillBar({ fraction, fillColor, height }: FillBarProps) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const target = clamp01(fraction);
  const trackHeight = height ?? t.progress.track;

  const widthFrac = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    widthFrac.set(
      withTiming(target, {
        duration: t.motion.base,
        easing: t.motion.easing.standard,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [target, t.motion, widthFrac]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthFrac.get() * 100}%`,
  }));

  const track: ViewStyle = {
    height: trackHeight,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
    justifyContent: 'center',
  };
  const fill: ViewStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: fillColor,
    borderRadius: t.radii.full,
  };

  return (
    <View style={track}>
      <Animated.View style={[fill, fillStyle]} />
    </View>
  );
}
