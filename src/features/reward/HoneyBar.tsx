import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// HoneyBar — the signature cell-fill bar (DESIGN §2.6 honey row). A hairline
// track filled to `pct%` with the amber honey family (amberTint → amber). Eases
// the fill in on mount; reduce-motion renders the final width instantly.
//
// Not the full Honeycomb SVG (that's a later phase) — a calm linear stand-in
// that still delivers the "you can see the honey ripen" beat.
// ──────────────────────────────────────────────────────────────────────────────

export function HoneyBar({ pct }: { pct: number }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));

  const progress = useSharedValue(reducedMotion ? clamped : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = clamped;
      return;
    }
    progress.value = withTiming(clamped, { duration: t.motion.honeyFill });
  }, [clamped, reducedMotion, progress, t.motion.honeyFill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  const track: ViewStyle = {
    height: t.space[3],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentSoft,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <View
      style={track}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: clamped, min: 0, max: 100 }}
    >
      <Animated.View style={[fill, fillStyle]} />
    </View>
  );
}
