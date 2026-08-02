import { Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { HoneyRing } from '@/src/features/whenbee/HoneyRing';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { BeeCoin } from '@/src/components/BeeCoin';
import { useTheme } from '@/src/theme/useTheme';
import type { CompanionStage } from '@/src/engine';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

// Compact Today-header honey ring: the SAME animated HoneyRing as the hub, shrunk
// to t.headerRing.size, with a nameless BeeMascot inside (no name overlay, no
// tier/percent badge). Tap → the Whenbee hub. Behind the bee sits the SAME soft
// BeeCoin the hub uses (colors.companionCoin) — shrunk to headerRing.coinSize so
// it backs the bee inside the ring without enlarging the bee or ring. Honey is
// monotonic; the ring only ever fills forward.
//
// F14: the tier word used to also render as a caption under the ring — the
// SAME read `CalibrationCard` shows ~10pt below it on Today, an identical
// read stacked twice. The card is the fuller statement (tier word AND the
// percentage AND the next-unlock line), so the caption here was the one to
// drop; the ring's own accessibilityLabel (`headerRing.a11y`) still speaks
// the tier word, it just isn't drawn twice on screen. The caption was always
// `position:'absolute', top:'100%'` — excluded from this block's measured
// layout — so removing it does not change the block's height, and the
// sibling settings-gear icon (centered against the ring in the header row)
// does not move.
/** Maps an engine Tier value to its translated display word. */
function tierLabel(tier: HoneycombCell['tier'], tr: TFunction<'today'>): string {
  const key = tier.toLowerCase() as 'raw' | 'setting' | 'ripening' | 'thickening' | 'honest';
  return tr(`tiers.${key}`);
}

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
  const { t: tr } = useTranslation('today');
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

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
      accessibilityLabel={tr('headerRing.a11y', { tier: tierLabel(tier, tr) })}
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
      </Animated.View>
    </Pressable>
  );
}
