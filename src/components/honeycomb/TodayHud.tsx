import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { BeeCoin } from '@/src/components/BeeCoin';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tierBandProgress, type CompanionStage } from '@/src/engine';
import type { HoneycombCell } from './Honeycomb';

// ──────────────────────────────────────────────────────────────────────────────
// TodayHud — the persistent companion + honey HUD on Today (replaces the
// HoneycombStrip on this screen). One row:
//
//   (Whenbee)  Setting                                          ›
//              ▓▓▓▓▓▓▓░░░░░░░░  (honey bar toward the next tier)
//
// The bee is the living presence (its stage drives glow/float inside BeeMascot);
// the honey bar fills amber toward the next tier using the existing band progress.
// No "N logs to go" counter — the tier word + fill carry it, calm not chore-like.
// The whole card taps into the Whenbee hub, where the full per-category comb lives.
// Amber here is the sanctioned honey identity; it only ever fills, never drains.
// ──────────────────────────────────────────────────────────────────────────────

interface TodayHudProps {
  cells: HoneycombCell[];
  stage: CompanionStage;
  seed: number;
  onPress: () => void;
}

export function TodayHud({ cells, stage, seed, onPress }: TodayHudProps) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Lead = the most-ripened category; it drives the tier word + honey bar.
  const lead = cells.reduce<HoneycombCell | null>(
    (best, c) => (best === null || c.sharpness > best.sharpness ? c : best),
    null,
  );
  const tier = lead?.tier ?? 'Raw';
  const band = tierBandProgress(lead?.sharpness ?? 0);
  // Fraction filled toward the next tier; a capped (Honest) comb reads full.
  const fillPct = band.total > 0 ? Math.round((band.done / band.total) * 100) : 100;

  const variant = `stage-${stage}` as BeeVariant;

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
  };
  const tierLabel: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const track: ViewStyle = {
    height: t.progress.track,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${fillPct}%`,
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
      }}
      onPressOut={() => {
        if (!reduced) scale.set(withSpring(1, t.motion.spring));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Whenbee, honey tier ${tier}. Tap to open your honeycomb.`}
    >
      <Animated.View style={[card, pressStyle]}>
        {/* Coin lifts the bee off the card. Light: a solid periwinkle medallion with a
            soft shadow (white would melt into the white card). Dark: the soft raised coin. */}
        <View
          style={{
            width: t.companion.hudCoin,
            height: t.companion.hudCoin,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BeeCoin
            size={t.companion.hudCoin}
            color={t.colors.companionCoinHud}
            core={t.companion.hudCoinCore}
            solid={t.mode === 'light'}
            shadowColor={t.mode === 'light' ? t.colors.companionCoinShadow : undefined}
          />
          <BeeMascot size={t.companion.hudBee} variant={variant} seed={seed} animated />
        </View>
        <View style={{ flex: 1, gap: t.space[1.5] }}>
          <Text style={tierLabel}>{tier}</Text>
          <View style={track}>
            <View style={fill} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
      </Animated.View>
    </Pressable>
  );
}
