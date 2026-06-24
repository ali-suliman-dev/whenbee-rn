import { Pressable, Text, View, type TextStyle } from 'react-native';
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
import { BeeCoin } from '@/src/components/BeeCoin';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CompanionStage } from '@/src/engine';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

// Compact Today-header honey ring: the SAME animated HoneyRing as the hub, shrunk
// to t.headerRing.size, with a nameless BeeMascot inside (no name overlay, no
// RingBadge) and the tier word beneath. Tap → the Whenbee hub. Behind the bee sits
// the SAME soft BeeCoin the hub uses (colors.companionCoin) — shrunk to
// headerRing.coinSize so it backs the bee inside the ring without enlarging the bee
// or ring. Honey is monotonic; the ring only ever fills forward.
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

  // Tier word caption: absolutely positioned below the ring so the block measures
  // as the ring circle alone — that keeps the sibling gear centered to the circle,
  // not to circle + label (which would sit it too high).
  const caption: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
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
        <HoneyRing
          sharpness={sharpness}
          sealed={tier === 'Honest'}
          size={t.headerRing.size}
          stroke={t.headerRing.stroke}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <BeeCoin size={t.headerRing.coinSize} color={t.colors.companionCoin} />
            <BeeMascot
              size={t.headerRing.bee}
              variant={`stage-${stage}` as BeeVariant}
              seed={seed}
              animated
              glow={false}
            />
          </View>
        </HoneyRing>
        <Text style={caption}>{tier}</Text>
      </Animated.View>
    </Pressable>
  );
}
