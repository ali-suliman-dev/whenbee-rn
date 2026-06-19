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
import { RitualSeal } from '@/src/features/today/RitualSeal';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tierBandProgress, type CompanionStage } from '@/src/engine';
import type { HoneycombCell } from './Honeycomb';

// ──────────────────────────────────────────────────────────────────────────────
// TodayHud — ledger card on Today. Top Pressable = honey HUD routing to the hub;
// optional hairline footer = RitualSeal (right).
//
//   (Whenbee)  Setting                                          ›
//              ▓▓▓▓▓▓▓░░░░░░░░  (honey bar toward the next tier)
//   ─────────────────────────────────────────────
//                              Log one honest thing  ⬡
//
// Footer renders only when ritualEnabled. Amber here is the sanctioned honey
// identity; it only ever fills, never drains.
// ──────────────────────────────────────────────────────────────────────────────

interface TodayHudProps {
  cells: HoneycombCell[];
  stage: CompanionStage;
  seed: number;
  onPress: () => void;
  /** Whether the opt-in daily ritual is on (renders the seal). */
  ritualEnabled?: boolean;
  /** Whether something has been logged today (seal plays/holds sealed). */
  ritualDone?: boolean;
  /** Open the log flow from the ritual tap. */
  onLogRitual?: () => void;
}

export function TodayHud({
  cells,
  stage,
  seed,
  onPress,
  ritualEnabled = false,
  ritualDone = false,
  onLogRitual,
}: TodayHudProps) {
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

  const showFooter = ritualEnabled;

  // Card is now a column container — top row + optional footer stack vertically.
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
  };
  const tierLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
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
  const footer: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: t.space[3],
    borderTopWidth: t.borderWidth.share,
    borderTopColor: t.colors.hairline,
    paddingTop: t.space[2.5],
    marginTop: t.space[3],
  };

  return (
    <Animated.View style={[card, pressStyle]}>
      {/* Top pressable — routes to the Whenbee hub */}
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
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}
      >
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
      </Pressable>

      {/* Optional hairline footer: RitualSeal */}
      {showFooter ? (
        <View style={footer}>
          {ritualEnabled ? (
            <RitualSeal done={ritualDone} onLog={onLogRitual ?? (() => {})} />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}
