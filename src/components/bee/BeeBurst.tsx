import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { BeeMascot } from '@/src/components/BeeMascot';
import { RayBurst } from './RayBurst';
import { CoinBadge } from './CoinBadge';

// ──────────────────────────────────────────────────────────────────────────────
// BeeBurst — the brand reward illustration: a RayBurst sunburst, the BeeMascot
// floating gently at the centre, and a CoinBadge token at its upper-right shoulder.
// Replaces the old boxed reward cell. Reusable across every "moment":
//
//   reward  → amber  · "+1 nectar"   (a normal honest log)
//   upgrade → amber  · ▲             (a tier seal / Pro upgrade)
//   aha     → indigo · "aha"         (an eye-opening insight)
//
// Bee float is the calm ambient layer (sine, ±beeFloat); the coin bob runs phase-
// offset so the two never bob in lockstep. Reduce-motion → everything static.
// ──────────────────────────────────────────────────────────────────────────────

export type BeeBurstVariant = 'reward' | 'upgrade' | 'aha';

const BADGE: Record<BeeBurstVariant, { tone: 'amber' | 'indigo'; label?: string; isUpgrade?: boolean }> = {
  reward: { tone: 'amber', label: '+1 nectar' },
  upgrade: { tone: 'amber', isUpgrade: true },
  aha: { tone: 'indigo', label: 'aha' },
};

export function BeeBurst({
  variant = 'reward',
  beeSize,
  stageSize,
}: {
  variant?: BeeBurstVariant;
  beeSize?: number;
  stageSize?: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const stage = stageSize ?? t.burst.stage;
  const bee = beeSize ?? t.burst.bee;
  const spec = BADGE[variant];

  const float = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    float.set(
      withRepeat(withTiming(1, { duration: t.motion.float, easing: t.motion.easing.calm }), -1, true),
    );
  }, [reducedMotion, float, t.motion.float, t.motion.easing.calm]);

  const beeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.get() * t.burst.beeFloat }],
  }));

  const stageStyle: ViewStyle = {
    width: stage,
    height: stage,
    alignItems: 'center',
    justifyContent: 'center',
  };
  // Coin rides the bee's upper-right shoulder. Anchored as a fraction of the
  // stage so it tracks the bee at any stageSize (no float/clip when shrunk).
  const coinSlot: ViewStyle = {
    position: 'absolute',
    top: stage * 0.16,
    right: stage * 0.1,
  };

  return (
    <View style={stageStyle}>
      <RayBurst size={stage} />
      <Animated.View style={beeStyle}>
        <BeeMascot size={bee} />
      </Animated.View>
      <View style={coinSlot}>
        <CoinBadge
          tone={spec.tone}
          label={spec.label}
          delay={t.motion.base}
          icon={
            spec.isUpgrade ? (
              <Ionicons name="triangle" size={t.iconSize.xs} color={t.colors.onAmber} />
            ) : undefined
          }
        />
      </View>
    </View>
  );
}
