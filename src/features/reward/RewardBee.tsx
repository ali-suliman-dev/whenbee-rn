import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// RewardBee — the big Whenbee + cell placeholder for the Reward moment with a
// floating "+1 nectar" pill (DESIGN §2.6 .rewardbee/.dp). The hero pops in
// (scale .4→1) on a normal log; on a cap/seal it gets a calmer settle. The full
// procedural Whenbee/honeycomb SVG choreography is a LATER phase — this is the
// structural stand-in: a rounded honey-amber cell with the nectar pill above.
// Reduce-motion → no pop, final state immediately.
// ──────────────────────────────────────────────────────────────────────────────

export function RewardBee({ sealed = false }: { sealed?: boolean }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const scale = useSharedValue(reducedMotion ? 1 : 0.4);
  const pillOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const pillLift = useSharedValue(reducedMotion ? 0 : 8);

  useEffect(() => {
    if (reducedMotion) return;
    scale.value = withTiming(1, { duration: t.motion.reveal });
    pillOpacity.value = withTiming(1, { duration: t.motion.base });
    pillLift.value = withTiming(0, { duration: t.motion.reveal });
  }, [reducedMotion, scale, pillOpacity, pillLift, t.motion.reveal, t.motion.base]);

  const cellStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ translateY: pillLift.value }],
  }));

  const stage: ViewStyle = { alignItems: 'center', gap: t.space[3] };

  const cell: ViewStyle = {
    width: 132,
    height: 132,
    borderRadius: t.radii['2xl'],
    backgroundColor: sealed ? t.colors.accent : t.colors.accentTint,
    borderWidth: 2,
    borderColor: sealed ? t.colors.accentEdge : t.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  };

  // A small inner "honey" dome — flat stand-in for the bee/cell.
  const dome: ViewStyle = {
    width: 64,
    height: 64,
    borderRadius: t.radii.pill,
    backgroundColor: sealed ? t.colors.onAmber : t.colors.accent,
    opacity: sealed ? 0.18 : 1,
  };

  const pill: ViewStyle = {
    backgroundColor: t.colors.primaryTint,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1],
  };
  const pillText: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.primary,
  };

  return (
    <View style={stage}>
      <Animated.View style={[pill, pillStyle]}>
        <AppText style={pillText}>+1 nectar</AppText>
      </Animated.View>
      <Animated.View style={[cell, cellStyle]} accessibilityLabel="Your Whenbee cell ripening">
        <View style={dome} />
      </Animated.View>
    </View>
  );
}
