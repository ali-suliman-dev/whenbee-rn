import { Pressable, View, Text, Platform, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { HoneyRing } from '@/src/features/whenbee/HoneyRing';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CompanionStage } from '@/src/engine';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

// Compact Today-header honey ring: the SAME animated HoneyRing as the hub, shrunk
// to t.headerRing.size, with a nameless BeeMascot inside (no name overlay, no
// RingBadge) and the tier word beneath. Tap → the Whenbee hub. A soft amber glow
// (iOS shadow — never boxShadow) blooms from the Ripening stage up via
// companion.glow. Honey is monotonic; the ring only ever fills forward.
export function TodayHeaderRing({
  sharpness,
  tier,
  stage,
  seed,
}: {
  sharpness: number;
  tier: HoneycombCell['tier'];
  stage: CompanionStage;
  seed: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const glowRadius = t.companion.glow[stage - 1] ?? 0;
  const glow: ViewStyle =
    Platform.OS === 'ios' && glowRadius > 0
      ? {
          shadowColor: t.colors.accent,
          shadowOpacity: t.headerRing.glowOpacity,
          shadowRadius: glowRadius,
          shadowOffset: { width: 0, height: 0 },
        }
      : {};

  const caption: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    fontSize: t.headerRing.caption,
    color: t.colors.inkSoft,
    textAlign: 'center',
    marginTop: t.space[1],
  };

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/whenbee')}
      onPressIn={() => {
        if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
      }}
      onPressOut={() => {
        if (!reduced) scale.set(withSpring(1, t.motion.spring));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Whenbee, honey tier ${tier}. Tap to open your honeycomb.`}
    >
      <Animated.View style={[{ alignItems: 'center' }, pressStyle]}>
        <View style={glow}>
          <HoneyRing
            sharpness={sharpness}
            sealed={tier === 'Honest'}
            size={t.headerRing.size}
            stroke={t.headerRing.stroke}
          >
            <BeeMascot
              size={t.headerRing.bee}
              variant={`stage-${stage}` as BeeVariant}
              seed={seed}
              animated
            />
          </HoneyRing>
        </View>
        <Text style={caption}>{tier}</Text>
      </Animated.View>
    </Pressable>
  );
}
